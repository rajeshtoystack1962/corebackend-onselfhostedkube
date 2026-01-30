import type { Request, Response } from 'express';
import { DockerService } from '../services/DockerService.js';
import { KubernetesService } from '../services/KubernetesService.js';
import { DnsService } from '../services/DnsService.js';
import { config } from '../config/index.js';
import path from 'path';

const dockerService = new DockerService();
const k8sService = new KubernetesService();
const dnsService = new DnsService();

export const deployRepo = async (req: Request, res: Response) => {
    try {
        const { gitUrl, branch, port, env, repoNameOverride } = req.body;

        if (!gitUrl || !branch || !port) {
            res.status(400).json({ error: 'gitUrl, branch, and port are required' });
            return;
        }

        // 1. Determine App Name & Repo Name
        const gitName = gitUrl.split('/').pop()?.replace('.git', '') || 'unknown';
        const cleanBranch = branch.replace(/[^a-zA-Z0-9]/g, '-');
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const baseName = repoNameOverride || `${gitName}-${cleanBranch}`.toLowerCase();
        const appName = `${baseName}-${randomSuffix}`.substring(0, 63); // K8s limit

        // 2. Clone Repo
        const repoPath = await dockerService.cloneRepo(gitUrl, branch, appName);

        // 3. Generate Dockerfile (if needed)
        await dockerService.detectAndGenerateDockerfile(repoPath, port);

        // 4. Build & Push Image
        const timestamp = Date.now();
        const imageName = `${config.acr.loginServer}/${appName}:${timestamp}`;

        // Login (optional if environment is already logged in, but good to ensure)
        if (config.acr.username && config.acr.password && config.acr.loginServer) {
            await dockerService.loginToRegistry(config.acr.loginServer, config.acr.username, config.acr.password);
        }

        await dockerService.buildImage(repoPath, imageName);
        await dockerService.pushImage(imageName);

        // Cleanup
        await dockerService.cleanUp(repoPath);

        // 5. DNS Management
        const domainName = `${appName}.${config.azure.dnsZone}`;
        // Ensure A record exists for the sub domain pointing to the ingress/LB IP
        await dnsService.ensureARecordExists(appName, config.targetIp);

        // 6. Kubernetes Deployment
        // Pass env vars to K8s
        const envVars = env || {};
        const customDomain = envVars['MY_CUSTOM_DNS'];

        await k8sService.deployApp(appName, imageName, domainName, envVars, customDomain);

        const response: any = {
            message: 'Deployment triggered successfully',
            appName,
            domain: `https://${domainName}`, // Traefik usually handles http->https redirect
            image: imageName
        };

        if (customDomain) {
            response.customDomain = `https://${customDomain}`;
        }

        res.json(response);

    } catch (error: any) {
        console.error('Deployment Failed:', error);
        res.status(500).json({ error: error.message });
    }
};
