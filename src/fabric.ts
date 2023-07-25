import {
  Wallet,
  Contract,
  Wallets,
  Gateway,
  GatewayOptions,
  DefaultEventHandlerStrategies,
  DefaultQueryHandlerStrategies,
  Network,
  Transaction,
} from "fabric-network";
import * as fproto from "fabric-protos";
import { createHash } from "crypto";
import { handleError } from "./utils/errors.js";
import * as config from "./utils/config.js";
import ccpFile from "./connection/ccp.json" assert { type: "json" };

export const createWallet = async (
  publicCertPem: string,
  privKey: string
): Promise<{ uid: string; wallet: Wallet }> => {
  const certificate = Buffer.from(publicCertPem, "base64").toString("ascii");
  const privateKey = Buffer.from(privKey, "base64").toString("ascii");
  const identity = {
    credentials: {
      certificate,
      privateKey,
    },
    type: "X.509",
    mspId: "SampleOrg",
  };
  const wallet = await Wallets.newFileSystemWallet("./connection/_wallet/");
  const uid = createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");
  await wallet.put(uid, identity);
  return { uid, wallet };
};

export const createGateway = async (
  wallet: any | Wallet,
  identity: string
): Promise<Gateway> => {
  const ccp: Record<string, unknown> = ccpFile;

  const gateway = new Gateway();
  const gatewayOpts: GatewayOptions = {
    wallet,
    identity,
    discovery: { enabled: false, asLocalhost: true },
    eventHandlerOptions: {
      commitTimeout: 300,
      endorseTimeout: 30,
      strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ANYFORTX,
    },
    queryHandlerOptions: {
      timeout: 3,
      strategy: DefaultQueryHandlerStrategies.PREFER_MSPID_SCOPE_ROUND_ROBIN,
    },
  };

  await gateway.connect(ccp, gatewayOpts);

  return gateway;
};

export const getNetwork = async (gateway: Gateway): Promise<Network> => {
  return await gateway.getNetwork(config.channelName);
};

export const GetContract = async (
  network: Network
): Promise<{ assetContract: Contract; qsccContract: Contract }> => {
  const assetContract = network.getContract(config.chaincodeName);
  const qsccContract = network.getContract("qscc");
  return { assetContract, qsccContract };
};

export async function evaluateTransaction(
  contract: Contract,
  transactionName: string,
  ...transactionArgs: string[]
): Promise<Buffer> {
  const transaction = contract.createTransaction(transactionName);
  const txid = transaction.getTransactionId();
  try {
    const payload = await transaction.evaluate(...transactionArgs);
    return payload;
  } catch (err) {
    throw handleError(txid, err);
  }
}

export async function submitTransaction(
  transaction: Transaction,
  ...transactionArgs: string[]
): Promise<any> {
  const txid = transaction.getTransactionId();
  try {
    const payload = await transaction.submit(...transactionArgs);
    return payload;
  } catch (err) {
    throw handleError(txid, err);
  }
}

export const getTransactionValidationCode = async (
  qsccContract: Contract,
  txid: string
): Promise<string> => {
  const data = await evaluateTransaction(
    qsccContract,
    "GetTransactionByID",
    config.chaincodeName,
    txid
  );

  const processedTx = fproto.protos.ProcessedTransaction.decode(data);
  return fproto.protos.TxValidationCode[processedTx.validationCode];
};

export const getBlockHeight = async (
  qscc: Contract
): Promise<number | Long.Long> => {
  const data = await qscc.evaluateTransaction(
    "GetChainInfo",
    config.chaincodeName
  );
  const info = fproto.common.BlockchainInfo.decode(data);
  return info.height;
};

export const pingChaincode = async (contract: Contract): Promise<boolean> => {
  try {
    const resBytes: Buffer = await contract.evaluateTransaction(
      "org.hyperledger.fabric:GetMetadata"
    );
    const resJson = JSON.parse(resBytes.toString());
    return resJson.contracts;
  } catch (e) {
    throw handleError("PING", e);
  }
};


