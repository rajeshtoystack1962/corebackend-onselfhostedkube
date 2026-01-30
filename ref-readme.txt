

1.I have self hosted Kubernetes cluster  in remote server .
2.i want to setup node backend server which I should be able do like.
	a.using curl or post-man, api  I should be able to start the specific repo deployment.
	b.while using curl or postman, api I will pass reponame, branch name, port, if required any env variable for that repo based backend ill pass those
	c.all names like namespace, deployment name , service name these are repo name+some random string then it needs to use for all same name. If there is possibility ingress route we needs to apply two that time for same kind  more then one means repo name + random string + mapped , so for entire namespace related names are same but only some are come with mapped to make unique.

3.we have DNS zone, I will make sure and give you steps to how we can create A record with specific ip so whatever deployment we doing

4.
	a.I will give input in backend endpoint  git clone url , branch like [ https://github.com/rajeshArunachalm/testrepo.git , main ]
	b.above


5.
whatever angular, node, wasp, java, solar, gaoling these are the repos we can Abel to deploy and for that how docker file needs to create below is the information.
### How the Dockerfile is created (detail): `createStack` + `docker-templates.ts`

`createStack` in **`stack-builder.ts`** decides the **framework** (from `repository.framework` or earlier detection) and then either:

1. **Calls a helper from `docker-templates.ts`** — those helpers **generate** Dockerfile content from a template and **write** it to `rootDirectory/Dockerfile`, or  
2. **Builds the Dockerfile content inline** in `stack-builder.ts` (template string) and writes it to a file (often a **temp** Dockerfile for static-site flows that don’t leave a final Dockerfile in the repo).

Inputs for both paths come from **`repositoryBuildSettings`** (and sometimes **`secretsWithValues`**, **`repository.forkedFromUrl`**).

#### 1. Path A: `docker-templates.ts` (write `Dockerfile` in repo root)

Used when the app will be **built as a Docker image** and pushed to ACR (no static deploy).  
`createStack` calls one of:

| Framework (in createStack) | Function called | Template function | File written |
|----------------------------|-----------------|-------------------|--------------|
| **ANGULAR** | `dockeriseReactApp(...)` | `getDockerFileContentForReact` | `rootDirectory/Dockerfile` |
| **NODE** | `dockeriseNodeApp(...)` | `getDockerFileContentForNode` | `rootDirectory/Dockerfile` |
| **WASP** | `dockeriseWaspApp(...)` | `getDockerFileContentForWasp` | `rootDirectory/Dockerfile` |
| **JAVA** | `dockeriseJavaApp(...)` | `getDockerFileContentForJava` | `rootDirectory/Dockerfile` |
| **SOLARA** | `dockeriseSolaraApp(...)` | `getDockerFileContentForSolara` | `rootDirectory/Dockerfile` |
| **GOLANG** | `dockeriseGoApp(...)` | `getDockerFileContentForGo` | `rootDirectory/Dockerfile` |

Each **`dockeriseXxxApp`** in `docker-templates.ts`:

1. Calls **`getDockerFileContentForXxx(...)`** with values from `repositoryBuildSettings` (e.g. `nodeVersion`, `dependencyInstallationCommand`, `buildCommand`, `port`, `postInstallationCommand`).
2. Gets back a **string** (full Dockerfile content).
3. Writes it to **`path.join(baseDir, 'Dockerfile')`** with `fs.writeFileSync(dockerfilePath, dockerfileContent)`.

So the **Dockerfile is created** by: **template function (content) → `dockeriseXxxApp` (write to `baseDir/Dockerfile`)**.

Example (Node):  
`getDockerFileContentForNode(nodeVersion, dependencyInstallationCommand, buildCommand, postInstallationCommand, port)` returns a string like:

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn build    # if buildCommand set
EXPOSE 8000
CMD ["yarn", "run", "start"]
```

`dockeriseNodeApp` then does `fs.writeFileSync(path.join(baseDir, 'Dockerfile'), thatString)`.

#### 2. Path B: Inline in `stack-builder.ts` (template string + `fs.writeFileSync`)

Used for **REACT** (static deploy), **NEXT** (static), **ASTRO/VUE** (static), **BASIC_HTML_JS** (no Dockerfile), and for the **“else”** branch (repo already has a Dockerfile).

- **REACT (framework REACT)**  
  - Builds **`dockerFileContent`** as a string in `createStack`: uses `nodeVersion`, `dependencyInstallationCommand`, `buildCommand`, optional `lockfileCopy` / `npmrcCopy`, and **`repository.forkedFromUrl`** to choose:
    - **Forked repo:** `COPY . .` first, then install/build (no layer caching for deps).
    - **Non-forked:** `COPY package.json` (+ lockfile) first, then `RUN install`, then `COPY . .`, then `RUN build` (better caching).
  - Writes **`.env`** from `secretsWithValues` in `rootDirectory`.
  - Writes Dockerfile to a **temp file** (`temp<uuid>.Dockerfile`), runs a **temporary** Docker build, copies `build`/`dist` out of the container, then **deploys as static site** (no final Dockerfile left for ACR). So for REACT, the “create Dockerfile” step is **inline in stack-builder**, not from `docker-templates.ts`.

- **NEXT / ASTRO+VUE**  
  - Same idea: **Dockerfile content** is built as a string inside `createStack` (with `nodeVersion`, `dependencyInstallationCommand`, `buildCommand`, lockfile, etc.), then **`fs.writeFileSync(tempDockerfile, dockerFileContent)`** to a temp Dockerfile. After a temp build, output is used for static deploy; no persistent `Dockerfile` in repo.

- **BASIC_HTML_JS**  
  - No Dockerfile; static site deploy only.

- **Else (e.g. repo already has Dockerfile)**  
  - Does **not** create a new Dockerfile. Uses existing `rootDirectory/Dockerfile` and only **comments out** `COPY .env` (or similar) via **`commentOutEnvCopyInDockerfile(dockerFilePath)`** in `stack-builder.ts`.

#### 3. Summary: who creates the Dockerfile and where

| Source | When | Where it’s written |
|--------|------|--------------------|
| **docker-templates.ts** | ANGULAR, NODE, WASP, JAVA, SOLARA, GOLANG | `rootDirectory/Dockerfile` (used later by `buildAndPushDockerImage`) |
| **stack-builder.ts inline** | REACT, NEXT, ASTRO, VUE | Temp file (e.g. `temp<uuid>.Dockerfile`); after build, file is removed; no final Dockerfile for ACR (static deploy) |
| **Existing Dockerfile** | Else (unknown/custom framework) | No creation; only `commentOutEnvCopyInDockerfile(rootDirectory/Dockerfile)` |

So: **create Dockerfile** = either **`docker-templates.ts`** (template + `dockeriseXxxApp` → `Dockerfile` in repo root) or **inline in `stack-builder.ts`** (string + `fs.writeFileSync` to temp or existing file).

---



6.

### Docker build and push in detail

This section explains **exactly** how the Docker image is built and pushed to the registry (ACR or ECR), step by step.

#### 1. When build and push run

- **Where:** `createStack` in **`stack-builder.ts`** (after the Dockerfile is written to `rootDirectory`).
- **Call:** `buildAndPushDockerImage(deployment.id, ownerRepositoryName, buildContext, platform)`.
- **Inputs:**
  - `deploymentId` — for logging and DB update.
  - `ownerRepositoryName` — e.g. `{ownerName}-{repositoryName}-{branchName}` (cleaned).
  - `buildContext` — path to the app root (same as `rootDirectory`), where the Dockerfile and source live.
  - `platform` — `linux/amd64` or `linux/arm64` from `repositoryBuildSettings.osArchitecture`.

#### 2. Image name and registry

- **Image name:** `imageName = \`${ACR_REPOSITORY_URL}/${ownerRepositoryName}:latest\``  
  Example: `myregistry.azurecr.io/john-myapp-main:latest`.
- **Env:** `ACR_REPOSITORY_URL` must be set (e.g. `myregistry.azurecr.io`). For AWS, the same flow is used but the backend also ensures an ECR repository exists (see below).

#### 3. Registry preparation (AWS only)

- **If `CLOUD_PROVIDER === 'AWS'`:**
  - Uses **ECR** client (`DescribeRepositoriesCommand`, `CreateRepositoryCommand`).
  - Tries to describe a repository named `ownerRepositoryName`; if `RepositoryNotFoundException`, creates the ECR repository (so `docker push` has a target).
- **Azure (ACR):** No repo creation in code. ACR login is done separately (see step 7). You must have the registry and (if needed) repo already; Docker push will create the repo in ACR automatically by name.

#### 4. Locate Dockerfile in build context

- **Code:** `buildAndPushDockerImage` in **`stack-builder.ts`**.
- **Steps:**
  1. `fs.readdirSync(buildContext)` to list files in the build-context directory.
  2. Filter for a file whose **lowercase** name is `'dockerfile'` (any casing: `Dockerfile`, `dockerfile`, etc.).
  3. If none found → **throw** `'No Dockerfile found in build context'`.
  4. If the found file is not exactly `'Dockerfile'`, copy it to `buildContext/Dockerfile` with `fs.copyFileSync` so Docker sees a file named `Dockerfile`.

#### 5. Build the image (Dockerode)

- **Library:** **Dockerode** (`new Docker()`), which talks to the local Docker daemon (same as `docker` CLI).
- **Call:**  
  `docker.buildImage(archiveOpts, imageOpts)`  
  where:
  - **archiveOpts:** `{ context: buildContext, src: fs.readdirSync(buildContext) }` — the build context is the directory path; `src` is the list of file/dir names to include (Dockerode will create a tarball from that directory).
  - **imageOpts:** `{ t: imageName, platform: platform }` — tag the image as `imageName` (e.g. `ACR_URL/owner-repo-branch:latest`) and set the target platform (`linux/amd64` or `linux/arm64`).
- **Return:** A **stream** (build log stream).
- **Waiting for completion:**  
  `docker.modem.followProgress(stream, onFinish, onProgress)`  
  - **onFinish:** Resolve if no error; reject if build failed.  
  - **onProgress:** For each event, if `event.error` set an error flag and log it; if `event.stream` log the line. All build output is also sent to **ToystackBuildLogger** (`tpl.log(...)`) so the UI/user sees logs.
- So the **Docker build** is: **same machine as the backend**, **same Docker daemon** as `docker build` would use, with the same context and Dockerfile.

#### 6. Push the image to the registry

- **After** the build promise resolves (build succeeded):
  1. Log: “Image built successfully. Pushing to Remote registry...”.
  2. **Run:** `executeCommand(\`docker push ${imageName}\`)`.
- **executeCommand** (in **`src/utils/misc.ts`**):
  - Uses Node **`exec(command, callback)`** to run the string in the **shell** (e.g. `docker push myregistry.azurecr.io/john-myapp-main:latest`).
  - Callback receives `(error, stdout, stderr)`. On success, `resolve(stdout)`; on error, still `resolve(error)` (so the caller gets the error object). So the push is a **real `docker push`** in the shell.
- **Digest:** The push output string is parsed for `'digest: '`. If present, the digest (e.g. `sha256:abc...`) is extracted and saved:
  - **DB:** `prisma.deployment.update({ where: { id: deploymentId }, data: { imageTag: imageHash } })`.
- **Return:** `buildAndPushDockerImage` returns `imageName` (full tag) so the caller can use it for Kubernetes (e.g. `buildInfraOnAzureViaK8s(image, ...)`).

#### 7. ACR login (so `docker push` works)

- **`docker push`** to ACR only works if the Docker daemon is **logged in** to that registry.
- **Where:** **`src/tasks.ts`** → `acrCredentialRefreshJob`.
- **What:** Runs `executeCommand('az acr login --name toystackcoredev')`. The registry name is **hardcoded** (`toystackcoredev`). So the **host** that runs the backend must have **Azure CLI** installed and previously run `az login` (or use a service principal); then `az acr login` configures Docker to push to that ACR.
- **When:**  
  - At **startup** (server.ts registers the job).  
  - On a **cron** every 10 minutes (`*/10 * * * *`).  
  So by the time any `docker push` runs, the machine has usually already run `az acr login` at least once.

#### 8. Error handling

- **Build or push fails (inside `buildAndPushDockerImage` try/catch):**
  1. Log the error.
  2. **DB:** `prisma.deployment.update({ where: { id: deploymentId }, data: { status: FAILED } })`.
  3. Log “Deployment failed: Error building/pushing image”.
  4. Re-throw so the caller (e.g. `createStack`) does not continue to K8s deploy.
- So: **build failure** or **push failure** → deployment status set to **FAILED**, no K8s deploy, user sees failure in logs/UI.

#### 9. Temporary Docker build (static sites: React, Next, Astro, etc.)

- For **static** frameworks (REACT, NEXT, ASTRO/VUE), the code does **not** call `buildAndPushDockerImage`. It uses a **temporary** build only to produce `build/` or `dist/` or `.next/`, then deploys that as a **static site** (e.g. S3/Blob). That temporary build uses **`tempDockerBuild`** in **`src/schema/deployment/services/temp-docker-builder.ts`**.
- **tempDockerBuild(tempDockerfile, rootDirectory, toystackLogger, imageName):**
  - Sets `process.env.DOCKER_BUILDKIT = '1'`.
  - **Spawns** the **`docker`** process: `spawn('docker', ['build', '-f', tempDockerfile, '-t', imageName, rootDirectory])` — so it’s a **shell `docker build -f <file> -t <tag> <context>`**.
  - Streams stdout/stderr to **ToystackBuildLogger** (info/warn/error by content).
  - Returns a **Promise** that resolves when the process exits with code 0; rejects on non-zero.
- That image is only used to **copy** files out of the container (`docker create` + `docker cp`); it is **not** pushed to ACR. After copy, the container and image are removed (`docker rm`, `docker rmi`).

#### 10. Summary: build and push flow

| Step | Where | What |
|------|--------|------|
| 1. Decide platform | `createStack` | `linux/amd64` or `linux/arm64` from `repositoryBuildSettings.osArchitecture`. |
| 2. Call build+push | `createStack` | `buildAndPushDockerImage(deploymentId, ownerRepositoryName, buildContext, platform)`. |
| 3. Image name | `buildAndPushDockerImage` | `${ACR_REPOSITORY_URL}/${ownerRepositoryName}:latest`. |
| 4. ECR (AWS only) | Same | Ensure ECR repo exists for `ownerRepositoryName`. |
| 5. Find Dockerfile | Same | `readdirSync` → filter lowercase `'dockerfile'` → copy to `Dockerfile` if needed. |
| 6. Build | Same | Dockerode `docker.buildImage(context, { t, platform })`; `followProgress` for logs. |
| 7. Push | Same | `executeCommand('docker push ' + imageName)` (shell). |
| 8. Save digest | Same | Parse stdout for `digest:`; `prisma.deployment.update({ imageTag })`. |
| 9. ACR login | `tasks.ts` | `executeCommand('az acr login --name toystackcoredev')` at startup and every 10 min. |
| 10. On failure | Same | `prisma.deployment.update({ status: FAILED })`; re-throw. |

**Temp build (static only):** `temp-docker-builder.ts` → `tempDockerBuild` → `spawn('docker', ['build', '-f', tempDockerfile, '-t', imageName, rootDirectory])` — no push; image removed after copying build output.

---


7.

## After push to ACR, before namespace: Azure DNS A record (toystack.dev)

Right after the image is pushed to ACR, **`buildInfraOnAzureViaK8s`** runs. Inside it, the **Azure DNS A record** for the app’s domain is handled **before** the Kubernetes namespace is created. Below is the flow **only for Azure DNS** when the DNS zone is **toystack.dev**.

### Order of operations (after push, before namespace)

1. **Push to ACR** completes → `createStack` calls **`buildInfraOnAzureViaK8s(image, deploymentId, specification)`**.
2. Inside **`buildInfraOnAzureViaK8s`** (in **`stack-builder.ts`**):
   - Resolve **domain name** and **app name**.
   - **Check if an A record already exists** in Azure DNS for that domain.
   - **Get the target IP** from the config table (Traefik or AKS LB).
   - **Update** `deployment.mappedDnsRecord` with that IP.
   - **If the A record does not exist**, call **`createARecord`** to create it in the **toystack.dev** zone (this call is **not awaited**).
   - **Then** create the Kubernetes **namespace** and the rest of the K8s resources.

So the sequence is: **push → buildInfraOnAzureViaK8s → (get A record, get IP, update deployment, create A record if missing) → create namespace**.

### Where it runs

- **File:** `src/schema/deployment/services/stack-builder.ts`
- **Function:** **`buildInfraOnAzureViaK8s`** (starts around line 614).

### Domain and DNS zone

- **Full domain** for the app comes from **`specification.customDomainName`** (lowercased), e.g. `myapp.toystack.dev` or `xyz123.toystack.dev`.
- **DNS zone** is the **base domain** from env: **`TOYSTACK_BASE_DOMAIN`** (e.g. **`toystack.dev`**). This is the **Azure DNS zone** name.
- **Record set name** (the “subdomain” in the zone) is computed as:
  - **`removeBaseDomain(domainName, TOYSTACK_BASE_DOMAIN)`**
  - Implemented in **`src/utils/misc.ts`**: regex `^(.+?)\.toystack\.dev$` on `domainName`; the first capture group is the subdomain.
  - Example: `domainName = "myapp.toystack.dev"`, `TOYSTACK_BASE_DOMAIN = "toystack.dev"` → **record set name = `"myapp"`**. So in zone **toystack.dev**, the A record name is **`myapp`**, and the full name is **`myapp.toystack.dev`**.

### Step 1: Check if the A record already exists

- **Azure API:** **`DnsManagementClient`** from **`@azure/arm-dns`**.
- **Credential:** **`DefaultAzureCredential`** (uses env / managed identity / Azure CLI).
- **Call:**  
  `dnsClient.recordSets.get(resourceGroupName, zoneName, recordSetName, 'A')`  
  where:
  - **resourceGroupName** = **`CLUSTER_RESOURCE_GROUP`** (env) — resource group that contains the DNS zone.
  - **zoneName** = **`TOYSTACK_BASE_DOMAIN`** — e.g. **`toystack.dev`** (the DNS zone).
  - **recordSetName** = **`removeBaseDomain(domainName, TOYSTACK_BASE_DOMAIN)`** — e.g. **`myapp`** for `myapp.toystack.dev`.
- If the record exists, **`arecord`** is set; otherwise the catch block runs and **`arecord`** stays undefined, meaning “A record does not exist”.

### Step 2: Get the target IP (Traefik or AKS LB)

- IP is read from the **`toystack_config`** table via **`getToystackConfigValue`** (in **`src/schema/misc/services/index.ts`**):
  - **`toystack_domain_traefik_ip`** — used when **`LOAD_BALANCER === 'traefik'`** (Traefik ingress IP).
  - **`toystack_aks_load_balancer_ip`** — used otherwise (e.g. AKS load balancer IP).
- So **all** app subdomains under **toystack.dev** point to the **same** IP (either Traefik or the AKS LB). Traefik/K8s then route by host (e.g. `myapp.toystack.dev`) to the right service.

### Step 3: Update deployment with the IP

- **`prisma.deployment.update({ where: { id: deploymentId }, data: { mappedDnsRecord: records[0] } })`**  
  so the deployment row stores which IP the domain is (or will be) pointing to.

### Step 4: Create the A record if it doesn’t exist

- **Only if `!arecord`** (A record was not found in step 1).
- A local async function **`createARecord`** is defined and then **called without `await`** (fire-and-forget):
  - **`createARecord(CLUSTER_RESOURCE_GROUP, TOYSTACK_BASE_DOMAIN, removeBaseDomain(domainName, TOYSTACK_BASE_DOMAIN), records, 300)`**
- **Inside `createARecord`:**
  - New **`DnsManagementClient`** with **`DefaultAzureCredential`** and **`AZURE_SUBSCRIPTION_ID`**.
  - **`dnsClient.recordSets.createOrUpdate(resourceGroupName, zoneName, subdomain, 'A', { ttl: ttl, aRecords: ipAddresses.map(ip => ({ ipv4Address: ip })) })`**
  - **Parameters:**
    - **resourceGroupName** = **`CLUSTER_RESOURCE_GROUP`**
    - **zoneName** = **`TOYSTACK_BASE_DOMAIN`** → **`toystack.dev`**
    - **subdomain** = **`removeBaseDomain(domainName, TOYSTACK_BASE_DOMAIN)`** → e.g. **`myapp`**
    - **TTL** = **300** seconds.
    - **aRecords** = one or more IPv4 addresses (in practice the single Traefik or AKS LB IP).
- So in **Azure DNS zone toystack.dev**, this **creates or updates** an **A** record whose **relative name** is the subdomain (e.g. **`myapp`**), i.e. **`myapp.toystack.dev`** → that IP.

**Important:** Because **`createARecord(...)` is not awaited**, the namespace (and the rest of K8s resources) are created **without waiting** for the A record create/update to finish. So the A record may still be propagating when the namespace is created.

### Step 5: Create the namespace

- **`await k8sApi.createNamespace({ metadata: { name: appName } })`**  
  So the **namespace** is created **after** the A record logic has been run (and after `createARecord` has been **started**, but not necessarily **completed**).

### Summary: Azure DNS (toystack.dev) and order

| Step | What | Where (stack-builder.ts) |
|------|------|---------------------------|
| 1 | Get domain: `specification.customDomainName` (e.g. `myapp.toystack.dev`) | start of `buildInfraOnAzureViaK8s` |
| 2 | Record set name: `removeBaseDomain(domainName, TOYSTACK_BASE_DOMAIN)` → e.g. `myapp` | used in get and create |
| 3 | Check A record: `dnsClient.recordSets.get(CLUSTER_RESOURCE_GROUP, toystack.dev, myapp, 'A')` | first try block |
| 4 | Get IP: `getToystackConfigValue('toystack_domain_traefik_ip')` or `'toystack_aks_load_balancer_ip'` | second try block |
| 5 | Update DB: `deployment.mappedDnsRecord = that IP` | same block |
| 6 | If no A record: `createARecord(..., toystack.dev, myapp, [IP], 300)` — **not awaited** | same block |
| 7 | Create namespace: `k8sApi.createNamespace({ name: appName })` | next try block |

**Env / config used for Azure DNS (toystack.dev):**

- **`TOYSTACK_BASE_DOMAIN`** = **`toystack.dev`** (Azure DNS zone name).
- **`CLUSTER_RESOURCE_GROUP`** = resource group containing the **toystack.dev** DNS zone.
- **`AZURE_SUBSCRIPTION_ID`** = Azure subscription for `DnsManagementClient`.
- **`LOAD_BALANCER`** = `'traefik'` or other (decides which config key is used for IP).
- **DB `toystack_config`** keys: **`toystack_domain_traefik_ip`**, **`toystack_aks_load_balancer_ip`** (values = IP strings).

**Result:** For an app with domain **`myapp.toystack.dev`**, the backend ensures an **A** record exists in the **toystack.dev** zone with **relative name** **`myapp`**, pointing to the Traefik or AKS LB IP, **before** the Kubernetes namespace for that app is created (with the caveat that the create is fire-and-forget, so propagation can still be in progress).

---



8.


---
# 1. Namespace (one per app)
apiVersion: v1
kind: Namespace
metadata:
  name: {appName}

---
# 2. Deployment (your app pods)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {deploymentName}
  namespace: {appName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {appName}
  template:
    metadata:
      labels:
        app: {appName}
    spec:
      containers:
        - name: {appName}
          image: {image}
          ports:
            - containerPort: 8080
          env: []
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"

---
# 3. Service (exposes app inside cluster; Traefik uses this)
apiVersion: v1
kind: Service
metadata:
  name: {appName}
  namespace: {appName}
  labels:
    app: {appName}
spec:
  type: NodePort
  selector:
    app: {appName}
  ports:
    - name: http
      port: 80
      targetPort: 8080

---
# 4. HorizontalPodAutoscaler
apiVersion: autoscaling/v1
kind: HorizontalPodAutoscaler
metadata:
  name: {appName}
  namespace: {appName}
  labels:
    app: {appName}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {deploymentName}
  minReplicas: 1
  maxReplicas: 3
  targetCPUUtilizationPercentage: 50

---
# 5. Role (RBAC – read pods/deployments in this namespace)
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: {appName}-role
  namespace: {appName}
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch"]

---
# 6. RoleBinding (binds Role to default ServiceAccount)
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: {appName}-rolebinding
  namespace: {appName}
subjects:
  - kind: ServiceAccount
    name: default
    namespace: {appName}
roleRef:
  kind: Role
  name: {appName}-role
  apiGroup: rbac.authorization.k8s.io

---
# 7. Traefik Middleware – rate limit (per app namespace)
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: {appName}-rate-limit
  namespace: {appName}
spec:
  rateLimit:
    average: 100
    burst: 200

---
# 8. Traefik Middleware – security headers (per app namespace)
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: {appName}-security-headers
  namespace: {appName}
spec:
  headers:
    customRequestHeaders:
      X-Forwarded-Proto: "https"
    customResponseHeaders:
      X-Frame-Options: "DENY"
      X-Content-Type-Options: "nosniff"
      X-XSS-Protection: "1; mode=block"
      Strict-Transport-Security: "max-age=31536000; includeSubDomains"
      Referrer-Policy: "strict-origin-when-cross-origin"
      Server: ""

---
# 9. Traefik IngressRoute – main domain (HTTPS, Let's Encrypt)
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: {appName}
  namespace: {appName}
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`{domainName}`)
      kind: Rule
      services:
        - name: {appName}
          namespace: {appName}
          port: 80
      middlewares:
        - name: {appName}-security-headers
        - name: {appName}-rate-limit
        - name: security-headers
          namespace: traefik
  tls:
    certResolver: le

---
# 10. (Optional) Traefik IngressRoute – mapped custom domains
#     Only created if the app has custom domains configured.
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: {appName}-mapped-route
  namespace: {appName}
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`custom-domain.example.com`)
      kind: Rule
      services:
        - name: {appName}
          namespace: {appName}
          port: 80
      middlewares:
        - name: {appName}-security-headers
        - name: {appName}-rate-limit
        - name: security-headers
          namespace: traefik
  tls:
    certResolver: le



9.
Verify dns ssl is secure or not like https://myapp.toystack.dev we ill check using curl command if the not secure wait till it is show as secure then display the secure url  then display message successfully deployed pls use the below url to access application.

