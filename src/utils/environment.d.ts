export {};

declare global {
    namespace NodeJS{
        interface ProcessEnv{
            NODE_ENV: 'development' | 'production' | 'test';
            PORT:number;
            CHANNEL_NAME:string;
            CHAINCODE_NAME:string;
        }
    }
}