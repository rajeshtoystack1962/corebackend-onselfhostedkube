import { DnsManagementClient } from '@azure/arm-dns';
import { DefaultAzureCredential } from '@azure/identity';
import { config } from '../config/index.js';

export class DnsService {
    private client: DnsManagementClient;

    constructor() {
        // Requires: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
        // or az login
        const credential = new DefaultAzureCredential();
        this.client = new DnsManagementClient(credential, config.azure.subscriptionId!);
    }

    async getARecord(subdomain: string) {
        try {
            return await this.client.recordSets.get(
                config.azure.resourceGroup!,
                config.azure.dnsZone,
                subdomain,
                'A'
            );
        } catch (err: any) {
            if (err.code === 'ResourceNotFound' || err.code === 'NotFound') {
                return null;
            }
            throw err;
        }
    }

    async createOrUpdateARecord(subdomain: string, ipAddress: string) {
        const ttl = 300;
        const recordSetName = subdomain;

        console.log(`Creating/Updating A record: ${subdomain}.${config.azure.dnsZone} -> ${ipAddress}`);

        await this.client.recordSets.createOrUpdate(
            config.azure.resourceGroup!,
            config.azure.dnsZone,
            recordSetName,
            'A',
            {
                ttl: ttl,
                aRecords: [{ ipv4Address: ipAddress }]
            }
        );
        console.log(`A record updated successfully.`);
    }

    async ensureARecordExists(subdomain: string, ipAddress: string) {
        const record = await this.getARecord(subdomain);
        if (record) {
            console.log(`A record for ${subdomain} already exists.`);
            // Optionally verify IP matches
            const currentIp = record.aRecords?.[0]?.ipv4Address;
            if (currentIp === ipAddress) {
                return;
            }
            console.log(`Updating IP from ${currentIp} to ${ipAddress}`);
        }
        await this.createOrUpdateARecord(subdomain, ipAddress);
    }
}
