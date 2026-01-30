import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    acr: {
        name: process.env.ACR_NAME,
        loginServer: process.env.ACR_LOGIN_SERVER,
        username: process.env.ACR_USERNAME,
        password: process.env.ACR_PASSWORD,
    },
    azure: {
        tenantId: process.env.AZURE_TENANT_ID,
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
        resourceGroup: process.env.AZURE_RESOURCE_GROUP,
        dnsZone: process.env.AZURE_DNS_ZONE || 'toystack.dev',
    },
    targetIp: process.env.TARGET_IP || '164.52.203.192',
};
