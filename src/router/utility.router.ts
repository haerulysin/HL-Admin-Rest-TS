import express, { Router, Request, Response } from "express";
import { getReasonPhrase } from "http-status-codes";
import { deleteIdentity, getAllIdentities, getIdentitesById } from "../fabric.ca.js";
import { ContractList } from "../utils/types.js";
import { Contract } from "fabric-network";
import { IServiceResponse } from 'fabric-ca-client';
import * as fcommon from 'fabric-common';
import * as fproto from '@hyperledger/fabric-protos';
import { decodeBlock, decodeProcessedTransaction } from "../utils/qscc.helper.js";
import { chaincodeName, channelName } from "../utils/config.js";


export const UtilityRouter: Router = express.Router();

UtilityRouter.get("/user/", async (req: Request, res: Response) => {
    try {
        const identityList = await getAllIdentities(req.user as string)
        return res.status(200).json(identityList.result.identities);
    } catch (e: any) {
        return res.status(500).json({
            status: getReasonPhrase(500),
            reason: e,
            timestamp: new Date().toISOString(),
        })
    }
});

UtilityRouter.get("/user/:enrollmentID", async (req: Request, res: Response) => {
    const { enrollmentID } = req.params;
    try {
        const identityList = await getIdentitesById(req.user as string, enrollmentID);
        return res.status(200).json(identityList.result)

    } catch (e) {
        return res.status(500).json({
            status: getReasonPhrase(500),
            message: e,
            timestamp: new Date().toISOString()
        })
    }
});

UtilityRouter.delete("/user/:enrollmentID", async (req: Request, res: Response) => {
    const { enrollmentID } = req.params;
    try {
        // const identityList = await getIdentitesById(req.user as string, enrollmentID);
        const deleteUser:IServiceResponse = await deleteIdentity(req.user as string, enrollmentID);

        if(deleteUser.success){
            return res.status(200).json(deleteUser)
        }else{
            return res.status(400).json({
                status: getReasonPhrase(400),
                message: deleteUser,
                timestamp: new Date().toISOString()
            })
        }
        

    } catch (e) {
        return res.status(500).json({
            status: getReasonPhrase(500),
            message: e,
            timestamp: new Date().toISOString()
        })
    }
});

UtilityRouter.get("/block", async (req: Request, res: Response) => {
    const contract = (req.app.locals[req.user as string] as ContractList).qsccContract as Contract;
    try {
        const chainInfoRaw = await contract.evaluateTransaction("GetChainInfo", channelName);
        const chainInfo = fproto.common.BlockchainInfo.deserializeBinary(chainInfoRaw);
        const blockHeight: number = chainInfo.getHeight();
        let blockList: any[] = [];
        for (let blockNumber = 0; blockNumber < blockHeight; blockNumber++) {
            const blockraw = await contract.evaluateTransaction("GetBlockByNumber", channelName, blockNumber.toString());
            const data = fproto.common.Block.deserializeBinary(blockraw);
            const decodedBlock = decodeBlock(data);
            blockList.push(decodedBlock);
        }
        return res.status(200).json(blockList)
    } catch (e: any) {
        return res.status(500).json({
            status: getReasonPhrase(500),
            message: e,
            timestamp: new Date().toISOString(),
        });
    }
});

UtilityRouter.get("/block/:blockId", async (req: Request, res: Response) => {
    const { blockId } = req.params;
    const contract = (req.app.locals[req.user as string] as ContractList).qsccContract as Contract;
    try {
        const blockraw = await contract.evaluateTransaction("GetBlockByNumber", channelName, blockId);
        const data = fproto.common.Block.deserializeBinary(blockraw);
        const decodedBlock = decodeBlock(data);
        return res.status(200).json(decodedBlock);
    } catch (e: any) {
        return res.status(500).json({
            status: getReasonPhrase(500),
            message: e,
            timestamp: new Date().toISOString(),
        });
    }
});

UtilityRouter.get("/transaction/:txId", async (req: Request, res: Response) => {
    const { txId } = req.params;
    const contract = (req.app.locals[req.user as string] as ContractList).qsccContract as Contract;
    try {
        const getBlockRaw = await contract.evaluateTransaction('GetBlockByTxID', channelName, txId);
        const blockData = fproto.common.Block.deserializeBinary(getBlockRaw);
        const getTxRaw = await contract.evaluateTransaction('GetTransactionByID', channelName, txId);
        const decodedBlock = decodeBlock(blockData);
        const decodedTransaction = decodeProcessedTransaction(getTxRaw);
        return res.status(200).json({
            txData: decodedTransaction,
            blockData: decodedBlock
        })
    } catch (e: any) {
        return res.status(500).json({
            status: getReasonPhrase(500),
            message: e,
            timestamp: new Date().toISOString(),
        });
    }
});