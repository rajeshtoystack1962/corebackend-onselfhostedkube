import * as k8s from '@kubernetes/client-node';
import { config } from '../config/index.js';

export class KubernetesService {
    private k8sApi: k8s.CoreV1Api;
    private k8sAppsApi: k8s.AppsV1Api;
    private k8sCustomApi: k8s.CustomObjectsApi;
    private rbacApi: k8s.RbacAuthorizationV1Api;
    private networkingApi: k8s.NetworkingV1Api;

    constructor() {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();

        this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        this.k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
        this.k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);
        this.rbacApi = kc.makeApiClient(k8s.RbacAuthorizationV1Api);
        this.networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
    }

    async createNamespace(appName: string) {
        const nsBody: k8s.V1Namespace = {
            metadata: { name: appName },
        };
        try {
            await this.k8sApi.createNamespace({ body: nsBody });
            console.log(`Namespace ${appName} created.`);
        } catch (err: any) {
            if (err.body?.code !== 409) {
                throw err;
            }
            console.log(`Namespace ${appName} already exists.`);
        }
    }

    async createDeployment(appName: string, image: string, envVars: k8s.V1EnvVar[] = []) {
        const deploymentName = `${appName}-deployment`;
        const deployment: k8s.V1Deployment = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: deploymentName,
                namespace: appName,
                labels: { app: appName },
            },
            spec: {
                replicas: 1,
                selector: { matchLabels: { app: appName } },
                template: {
                    metadata: { labels: { app: appName } },
                    spec: {
                        containers: [
                            {
                                name: appName,
                                image: image,
                                ports: [{ containerPort: 8080 }], // Assuming default port
                                env: envVars, // Array of { name: string, value: string }
                                resources: {
                                    requests: { cpu: '100m', memory: '128Mi' },
                                    limits: { cpu: '500m', memory: '512Mi' }
                                }
                            },
                        ],
                    },
                },
            },
        };

        try {
            await this.k8sAppsApi.createNamespacedDeployment({ namespace: appName, body: deployment });
            console.log(`Deployment ${deploymentName} created.`);
        } catch (err: any) {
            if (err.body?.code === 409) {
                // For simple update logic just replace image if exists, or use replaceNamespacedDeployment
                // Simpler for POC: delete and recreate or just replace
                await this.k8sAppsApi.replaceNamespacedDeployment({
                    name: deploymentName,
                    namespace: appName,
                    body: deployment
                });
                console.log(`Deployment ${deploymentName} updated.`);
            } else {
                throw err;
            }
        }
    }

    async createService(appName: string) {
        const serviceName = appName;
        const service: k8s.V1Service = {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: {
                name: serviceName,
                namespace: appName,
                labels: { app: appName }
            },
            spec: {
                type: 'ClusterIP', // Traefik usually works with ClusterIP
                selector: { app: appName },
                ports: [{
                    name: 'http',
                    port: 80,
                    targetPort: 8080
                }]
            }
        };

        try {
            await this.k8sApi.createNamespacedService({ namespace: appName, body: service });
            console.log(`Service ${serviceName} created.`);
        } catch (err: any) {
            if (err.body?.code !== 409) throw err;
            console.log(`Service ${serviceName} already exists.`);
        }
    }

    async createIngressRoute(appName: string, domainName: string) {
        // Traefik IngressRoute Custom Resource
        const ingressRoute = {
            apiVersion: 'traefik.io/v1alpha1',
            kind: 'IngressRoute',
            metadata: {
                name: appName,
                namespace: appName
            },
            spec: {
                entryPoints: ['websecure'],
                routes: [{
                    match: `Host(\`${domainName}\`)`,
                    kind: 'Rule',
                    services: [{
                        name: appName,
                        port: 80
                    }],
                    // middlewares: ... (Add middlewares if needed later)
                }],
                tls: {
                    certResolver: 'le' // Assuming 'le' is configured in Traefik
                }
            }
        };

        try {
            await this.k8sCustomApi.createNamespacedCustomObject({
                group: 'traefik.io',
                version: 'v1alpha1',
                namespace: appName,
                plural: 'ingressroutes',
                body: ingressRoute
            });
            console.log(`IngressRoute ${appName} created.`);
        } catch (err: any) {
            if (err.body?.code === 409) {
                // For CRD we might need get and update resourceVersion or just delete/create
                // Simplification for POC: log it exists
                console.log(`IngressRoute ${appName} already exists.`);
            } else {
                throw err;
            }
        }
    }

    async deployApp(appName: string, image: string, domainName: string, envVars: { [key: string]: string } = {}) {
        const k8sEnvVars = Object.entries(envVars).map(([name, value]) => ({ name, value }));
        await this.createNamespace(appName);
        await this.createDeployment(appName, image, k8sEnvVars);
        await this.createService(appName);
        await this.createIngressRoute(appName, domainName);
    }
}
