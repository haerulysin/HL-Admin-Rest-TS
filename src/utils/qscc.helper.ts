//Script from David Reis | @davidfdr at Medium.com
//https://medium.com/@davidfdr/hyperledger-fabric-decoding-the-block-and-the-transaction-a-big-adventure-qscc-decoding-db356a525502

import { X509 } from 'jsrsasign';
import { KVMetadataEntry, KVMetadataWrite, KVRead, KVWrite, RangeQueryInfo } from '@hyperledger/fabric-protos/lib/ledger/rwset/kvrwset/kv_rwset_pb.js';
import { MetadataSignature } from '@hyperledger/fabric-protos/lib/common/common_pb.js';
import * as fproto from '@hyperledger/fabric-protos'
import * as asn1 from 'asn1js';
import { createHash } from 'crypto';

export const decodeProcessedTransaction = (data: Buffer): { validationCode: number; decodedTransactionEnvelope: any } => {
    const decodedProcessedTransaction = { validationCode: {} as number, decodedTransactionEnvelope: {} };
    const processedTransaction: fproto.peer.ProcessedTransaction = fproto.peer.ProcessedTransaction.deserializeBinary(data);
    const validationCode = processedTransaction.getValidationcode();
    decodedProcessedTransaction.validationCode = validationCode;
    const transactionEnvelope: fproto.common.Envelope = processedTransaction.getTransactionenvelope() as fproto.common.Envelope;
    decodedProcessedTransaction.decodedTransactionEnvelope = decodeBlockDataEnvelope(transactionEnvelope);
    return decodedProcessedTransaction;
};

export const decodeBlockDataEnvelope = (envelope: fproto.common.Envelope): any => {
    const decodedBlockDataEnvelope: Record<any, any> = {
        channelId: {},
        transactionId: {},
        headerType: {},
        payloadHeaderSignature: {},
        creatorMsp: {},
        creatorId: {},
        creatorIdX509Info: {},
        creatorIdX509Subject: {},
        endorsements: {},
        chaincodeSpecs: {},
        proposalResponseHash: {},
        txReadWriteSet: [],
    };

    const envPayload: fproto.common.Payload = fproto.common.Payload.deserializeBinary(envelope.getPayload_asU8());
    const headerPayload: fproto.common.Header = envPayload.getHeader() as fproto.common.Header;
    decodedBlockDataEnvelope.payloadHeaderSignature = headerPayload.getSignatureHeader_asB64();
    const channelHeader: fproto.common.ChannelHeader = fproto.common.ChannelHeader.deserializeBinary(headerPayload.getChannelHeader_asU8());
    const channelId: string = channelHeader.getChannelId();
    decodedBlockDataEnvelope.channelId = channelId;
    const getTxId = channelHeader.getTxId();
    decodedBlockDataEnvelope.transactionId = channelHeader.getTxId();
    const headerType = channelHeader.getType();
    decodedBlockDataEnvelope.headerType = headerType;
    if (headerType === 3) {
        const transaction: fproto.peer.Transaction = fproto.peer.Transaction.deserializeBinary(envPayload.getData_asU8());
        const transactionActions: fproto.peer.TransactionAction[] = transaction.getActionsList();
        for (const transactionAction of transactionActions) {
            const signatureActionHeader = fproto.common.SignatureHeader.deserializeBinary(transactionAction.getHeader_asU8());
            const creator = fproto.msp.SerializedIdentity.deserializeBinary(signatureActionHeader.getCreator_asU8());
            const msp = creator.getMspid();
            decodedBlockDataEnvelope.creatorMsp = msp;
            const creatorId = Buffer.from(creator.getIdBytes_asB64(), 'base64');
            // decodedBlockDataEnvelope.creatorId = creatorId.toString();
            decodedBlockDataEnvelope.creatorId = '';
            const certX509 = new X509();
            certX509.readCertPEM(creatorId.toString());
            decodedBlockDataEnvelope.creatorIdX509Info = certX509.getInfo();
            decodedBlockDataEnvelope.creatorIdX509Subject = certX509.getSubject();
            const chaincodeActionPayload = fproto.peer.ChaincodeActionPayload.deserializeBinary(transactionAction.getPayload_asU8());
            const chaincodeEndorseAction: fproto.peer.ChaincodeEndorsedAction = chaincodeActionPayload.getAction() as fproto.peer.ChaincodeEndorsedAction;
            if (chaincodeEndorseAction) {
                const endorsements: Array<fproto.peer.Endorsement> = chaincodeEndorseAction.getEndorsementsList();
                const endorsementList = [];
                for (const endorsement of endorsements) {
                    const endorsementInfo = { endorserId: {}, endorserIdX509Info: {}, endorserIdX509Subject: {}, endorserMsp: {}, endorserSignature: {} };
                    const endorserIdentity = fproto.msp.SerializedIdentity.deserializeBinary(endorsement.getEndorser_asU8());
                    endorsementInfo.endorserSignature = endorsement.getSignature_asB64();
                    const endorserId = Buffer.from(endorserIdentity.getIdBytes_asB64(), 'base64');
                    endorsementInfo.endorserId = endorserId.toString();
                    certX509.readCertPEM(endorserId.toString());
                    endorsementInfo.endorserIdX509Info = certX509.getInfo();
                    endorsementInfo.endorserIdX509Subject = certX509.getSubject();
                    endorsementInfo.endorserMsp = endorserIdentity.getMspid();
                    endorsementList.push(endorsementInfo);
                }
                decodedBlockDataEnvelope.endorsements = endorsementList;
            }
            const chaincodeProposalPayload = fproto.peer.ChaincodeProposalPayload.deserializeBinary(chaincodeActionPayload.getChaincodeProposalPayload_asU8());
            const chaincodeInocationSpec = fproto.peer.ChaincodeInvocationSpec.deserializeBinary(chaincodeProposalPayload.getInput_asU8());
            const chaincodeSpec: fproto.peer.ChaincodeSpec = chaincodeInocationSpec.getChaincodeSpec() as fproto.peer.ChaincodeSpec;
            const chaincodeId: fproto.peer.ChaincodeID = chaincodeSpec.getChaincodeId() as fproto.peer.ChaincodeID;
            type chaincodeSpecsType = { chaincodeID: object; chaincodeArguments: any[] }
            const chaincodeSpecs: chaincodeSpecsType = { chaincodeID: {}, chaincodeArguments: [] }
            const chaincodeID = { name: {}, path: {}, version: {} };
            chaincodeID.name = chaincodeId.getName();
            chaincodeID.path = chaincodeId.getPath();
            chaincodeID.version = chaincodeId.getVersion();
            chaincodeSpecs.chaincodeID = chaincodeID;
            const chaincodeInput = chaincodeSpec.getInput();
            const chaincodeArgs: Array<string> | undefined = chaincodeInput?.getArgsList_asB64();
            if (chaincodeArgs) {
                let i = 0;
                for (const arg of chaincodeArgs) {
                    const argBuffer: Buffer = Buffer.from(arg, 'base64');
                    try {
                        chaincodeSpecs.chaincodeArguments.push(JSON.parse(argBuffer.toString('utf8')));
                    } catch (e) {
                        chaincodeSpecs.chaincodeArguments.push(argBuffer.toString('utf8'));
                    }
                }
                decodedBlockDataEnvelope.chaincodeSpecs = chaincodeSpecs;
            }
            const proposalResponsePayload: fproto.peer.ProposalResponsePayload = fproto.peer.ProposalResponsePayload.deserializeBinary(chaincodeEndorseAction.getProposalResponsePayload_asU8());
            const proposalResponseHash = Buffer.from(proposalResponsePayload.getProposalHash_asB64(), 'base64').toString('hex');
            decodedBlockDataEnvelope.proposalResponseHash = proposalResponseHash;
            const extension = proposalResponsePayload.getExtension_asU8();
            const chaincodeAction = fproto.peer.ChaincodeAction.deserializeBinary(extension);
            const results = chaincodeAction.getResults_asU8();
            const txReadWriteSet: fproto.ledger.rwset.TxReadWriteSet = fproto.ledger.rwset.TxReadWriteSet.deserializeBinary(results);
            const nsReadWriteSet: Array<fproto.ledger.rwset.NsReadWriteSet> = txReadWriteSet.getNsRwsetList();
            for (const rwSet of nsReadWriteSet) {
                type nsRWSetTypes = { namespace: any; kvReads: any[]; kvWrites: any[]; kvMetadataWrites: any[]; rangeQueryInfos: any[]; }
                const nsRWSet: nsRWSetTypes = { namespace: {}, kvReads: [], kvWrites: [], kvMetadataWrites: [], rangeQueryInfos: [] };
                const namespace = rwSet.getNamespace;
                nsRWSet.namespace = namespace;
                const kVRWSetProto = fproto.ledger.rwset.kvrwset.KVRWSet.deserializeBinary(rwSet.getRwset_asU8());
                const reads: Array<KVRead> = kVRWSetProto.getReadsList();
                for (const readSet of reads) {
                    const kvRead = { key: {}, version: {} };
                    kvRead.key = readSet.getKey();
                    kvRead.version = readSet.getVersion() as object;
                    nsRWSet.kvReads.push(kvRead)
                }
                const rangeQueryInfoProto: Array<RangeQueryInfo> = kVRWSetProto.getRangeQueriesInfoList();
                for (const rangeQ of rangeQueryInfoProto) {
                    const rangeQueryInfo = { startKey: {}, endKey: {} };
                    rangeQueryInfo.startKey = rangeQ.getStartKey();
                    rangeQueryInfo.endKey = rangeQ.getEndKey();
                    nsRWSet.rangeQueryInfos.push(rangeQueryInfo);
                }
                const writes: Array<KVWrite> = kVRWSetProto.getWritesList();
                for (const write of writes) {
                    const kvWrite = { key: {}, value: {} };
                    kvWrite.key = write.getKey();
                    const value = Buffer.from(write.getValue_asB64(), 'base64').toString();
                    try {
                        kvWrite.value = JSON.parse(value);
                    } catch (e) {
                        kvWrite.value = value;
                    }
                    nsRWSet.kvWrites.push(kvWrite);
                }
                const metadataWriltes: Array<KVMetadataWrite> = kVRWSetProto.getMetadataWritesList();
                for (const metadataWrite of metadataWriltes) {
                    const kvMetadataWrite: { key: any, entries: any[] } = { key: {}, entries: [] };
                    kvMetadataWrite.key = metadataWrite.getKey();
                    const metadataEntryList: Array<KVMetadataEntry> = metadataWrite.getEntriesList();
                    for (const entry of metadataEntryList) {
                        const ent = { name: {}, value: {} };
                        const value = Buffer.from(entry.getValue_asB64(), 'base64').toString();
                        try {
                            ent.value = JSON.parse(value);
                        } catch (e) {
                            ent.value = value;
                        }
                        ent.name = entry.getName();
                        kvMetadataWrite.entries.push(ent);
                    }
                    nsRWSet.kvMetadataWrites.push(kvMetadataWrite);
                }
                decodedBlockDataEnvelope.txReadWriteSet.push(nsRWSet);
            }
        }
    }
    return decodedBlockDataEnvelope;
};

/**
 * Decode the block
 * @param data
 */

type decodedBlockTypes = {
    dataHashAsB64: string;
    dataHashAsString: string;
    dataHash: string;
    previousBlockHashAsB64: string;
    decodedBlockDataEnvelopes: any[];
    previousBlockHash: string;
    blockNum: number;
    blockHash: string;
    previousBlockHashAsString: string;
    decodedBlockMetadata: any[];
}
export const decodeBlock = (
    block: fproto.common.Block,
): decodedBlockTypes => {
    const decodedBlock: decodedBlockTypes = {
        blockNum: {} as number,
        blockHash: {} as string,
        dataHash: {} as string,
        dataHashAsB64: {} as string,
        dataHashAsString: {} as string,
        previousBlockHash: {} as string,
        previousBlockHashAsB64: {} as string,
        previousBlockHashAsString: {} as string,
        decodedBlockDataEnvelopes: [],
        decodedBlockMetadata: [],
    };

    const blockHeader: fproto.common.BlockHeader = block.getHeader() as fproto.common.BlockHeader;
    const blockNum = blockHeader.getNumber();
    decodedBlock.blockNum = blockNum;
    const dataHash = blockHeader.getDataHash().toString();
    decodedBlock.dataHash = dataHash;
    const dataHashAsB64 = blockHeader.getDataHash_asB64();
    decodedBlock.dataHashAsB64 = dataHashAsB64;
    const dataHashAsString = Buffer.from(dataHashAsB64, 'base64').toString('hex');
    decodedBlock.dataHashAsString = dataHashAsString;
    const previousBlockHash = blockHeader.getPreviousHash().toString();
    decodedBlock.previousBlockHash = previousBlockHash;
    const previousBlockHashAsB64 = blockHeader.getPreviousHash_asB64();
    decodedBlock.previousBlockHashAsB64 = previousBlockHashAsB64;
    const previousBlockHashAsString = Buffer.from(previousBlockHashAsB64, 'base64').toString('hex');
    decodedBlock.previousBlockHashAsString = previousBlockHashAsString;
    const blockData: fproto.common.BlockData = block.getData() as fproto.common.BlockData;
    const blockDataList = blockData.getDataList_asU8();
    decodedBlock.blockHash = getBlockHash(blockHeader);
    if (blockDataList.length > 0) {
        for (const bl of blockDataList) {
            if (bl.length > 0) {
                const envelope = fproto.common.Envelope.deserializeBinary(bl);
                const decodedBlockDataEnvelope = decodeBlockDataEnvelope(envelope);
                decodedBlock.decodedBlockDataEnvelopes.push(decodedBlockDataEnvelope);
            } else {
            }
        }
    }
    const blockMetaData: fproto.common.BlockMetadata = block.getMetadata() as fproto.common.BlockMetadata;
    const blockMetaDataList: Array<Uint8Array> = blockMetaData.getMetadataList_asU8();
    const metadataProtoSignatures = blockMetaDataList[0];
    const metadata: fproto.common.Metadata = fproto.common.Metadata.deserializeBinary(metadataProtoSignatures);
    const metadataSignature: Record<any, any> = { value: {}, signatures: [] };
    const value = metadata.getValue_asB64();
    metadataSignature.value = value;
    const metadataSignatures: Array<MetadataSignature> = metadata.getSignaturesList();
    for (const metadataSig of metadataSignatures) {
        const metadataSign = { nonce: {}, blockSignerMsp: {}, blockSignerX509Info: {}, blockSignerX509Subject: {}, blockSignerCertificate: {}, blockSignerSignature: {} };
        const sigHeader: fproto.common.SignatureHeader = fproto.common.SignatureHeader.deserializeBinary(metadataSig.getSignatureHeader_asU8());
        const signerNonce = sigHeader.getNonce_asB64();
        const signer: fproto.msp.SerializedIdentity = fproto.msp.SerializedIdentity.deserializeBinary(sigHeader.getCreator_asU8());
        const signerMsp = signer.getMspid();
        const signerId = Buffer.from(signer.getIdBytes_asB64(), 'base64');
        const certX509 = new X509();
        certX509.readCertPEM(signerId.toString());
        metadataSign.nonce = signerNonce;
        metadataSign.blockSignerMsp = signerMsp;
        metadataSign.blockSignerX509Info = certX509.getInfo();
        metadataSign.blockSignerX509Subject = certX509.getSubject();
        metadataSign.blockSignerCertificate = signerId.toString();
        metadataSign.blockSignerSignature = metadataSig.getSignature_asB64();
        metadataSignature.signatures.push(metadataSign);
    }
    decodedBlock.decodedBlockMetadata.push(metadataSignature);
    const metadataProto1 = blockMetaDataList[1];
    decodedBlock.decodedBlockMetadata.push(metadataProto1);
    const metadataProto2 = blockMetaDataList[2];
    const transactionFilter = { transactionFilter: {} };
    transactionFilter.transactionFilter = metadataProto2;
    decodedBlock.decodedBlockMetadata.push(transactionFilter);
    const metadataProto3 = blockMetaDataList[3];
    decodedBlock.decodedBlockMetadata.push(metadataProto3);
    const metadataProto4 = blockMetaDataList[4];
    const commitHash = {
        commitHashB64: {},
    };
    commitHash.commitHashB64 = Buffer.from(metadataProto4).toString('base64');
    decodedBlock.decodedBlockMetadata.push(commitHash);
    return decodedBlock;
};

export const decodeBlockProtobuf = (
    data: Buffer,
): {
    dataHashAsB64: string;
    dataHashAsString: string;
    dataHash: string;
    previousBlockHashAsB64: string;
    decodedBlockDataEnvelopes: any[];
    previousBlockHash: string;
    blockNum: number;
    previousBlockHashAsString: string;
} => {
    const block: fproto.common.Block = fproto.common.Block.deserializeBinary(data);
    const decodedBlock = decodeBlock(block);
    return decodedBlock;
};

export const decodeBlockEventProtobuf = (
    header: Buffer,
    data: Buffer,
    metadata: Buffer,
): {
    dataHashAsB64: string;
    dataHashAsString: string;
    dataHash: string;
    previousBlockHashAsB64: string;
    decodedBlockDataEnvelopes: any[];
    previousBlockHash: string;
    blockNum: number;
    previousBlockHashAsString: string;
} => {
    const block: fproto.common.Block = fproto.common.Block.deserializeBinary(data);
    const decodedBlock = decodeBlock(block);
    return decodedBlock;
};



export const getBlockHash = (header: fproto.common.BlockHeader): string => {
    // console.log(Buffer.from(header.getPreviousHash()))

    let sequence = new asn1.Sequence({
        value: [
            new asn1.Integer({ value: header.getNumber() }),
            new asn1.OctetString({ valueHex: Buffer.from(header.getPreviousHash()) }),
            new asn1.OctetString({ valueHex: Buffer.from(header.getDataHash()) }),
        ]
    })
    let sequenceBuffer = Buffer.from(sequence.toBER())
    let blockHash = createHash('sha256').update(sequenceBuffer).digest('hex');
    return blockHash;
}