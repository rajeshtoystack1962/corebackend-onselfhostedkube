import Docker from 'dockerode';
import { simpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class DockerService {
    private docker: Docker;
    private workDir: string;

    constructor() {
        this.docker = new Docker();
        this.workDir = path.join(process.cwd(), 'temp_builds');
        // Ensure the temp directory exists
        if (!fs.existsSync(this.workDir)) {
            fs.mkdirSync(this.workDir, { recursive: true });
        }
    }

    async loginToRegistry(server: string, username: string, password: string): Promise<void> {
        await execAsync(`docker login ${server} -u ${username} -p ${password}`);
    }


    async cloneRepo(repoUrl: string, branch: string, repoName: string): Promise<string> {
        const repoPath = path.join(this.workDir, repoName);
        if (fs.existsSync(repoPath)) {
            await fs.remove(repoPath);
        }
        await simpleGit().clone(repoUrl, repoPath, ['--branch', branch, '--depth', '1']);
        return repoPath;
    }

    async detectAndGenerateDockerfile(repoPath: string, port: number) {
        const dockerfilePath = path.join(repoPath, 'Dockerfile');
        if (fs.existsSync(dockerfilePath)) {
            console.log('Dockerfile exists, using it.');
            return;
        }

        console.log('Dockerfile not found, generating one...');
        let dockerfileContent = '';

        if (fs.existsSync(path.join(repoPath, 'package.json'))) {
            // Node.js detection
            const packageJson = await fs.readJson(path.join(repoPath, 'package.json'));
            const isStatic = packageJson.dependencies?.react || packageJson.dependencies?.['next'];

            // Simple Node.js template
            dockerfileContent = `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build || true
EXPOSE ${port}
CMD ["npm", "start"]
`;
            // TODO: Add better static site handling similar to reference logic later if needed
        } else if (fs.existsSync(path.join(repoPath, 'requirements.txt'))) {
            // Python detection
            dockerfileContent = `
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE ${port}
CMD ["python", "app.py"]
`;
        } else {
            throw new Error('Unsupported framework or no Dockerfile found');
        }

        await fs.writeFile(dockerfilePath, dockerfileContent);
    }

    async buildImage(repoPath: string, imageName: string): Promise<void> {
        console.log(`Building image: ${imageName}...`);
        // Using docker build command for simplicity and stream handling
        // We could use dockerode buildImage but shelling out is often more reliable for simple monitoring
        await execAsync(`docker build -t ${imageName} ${repoPath}`);
    }

    async pushImage(imageName: string): Promise<void> {
        console.log(`Pushing image: ${imageName}...`);
        await execAsync(`docker push ${imageName}`);
    }

    async cleanUp(repoPath: string) {
        await fs.remove(repoPath);
    }
}
