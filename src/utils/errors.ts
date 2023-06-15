import { TimeoutError, TransactionError } from "fabric-network";
// import { logger } from "./logger";

export enum RetryAction {
  WithExistingTransactionId,
  WithNewTransactionId,
  None,
}

export const isDuplicateTransactionError = (err: unknown): boolean => {
  if (err === undefined || err === null) return false;
  let isDuplicate;
  if (typeof (err as TransactionError).transactionCode === "string") {
    isDuplicate =
      (err as TransactionError).transactionCode === "DUPLICATE_TXID";
  } else {
    const endorsementError = err as {
      errors: { endorsements: { details: string }[] }[];
    };
    isDuplicate = endorsementError?.errors?.some((err) =>
      err?.endorsements?.some((endorsement) =>
        endorsement?.details?.startsWith("duplicate transaction found")
      )
    );
  }

  return isDuplicate === true;
};

export const isErrorLike = (err: unknown): err is Error => {
  return (
    err != undefined &&
    err != null &&
    typeof (err as Error).name === "string" &&
    typeof (err as Error).message === "string" &&
    ((err as Error).stack === undefined ||
      typeof (err as Error).stack === "string")
  );
};

export class ContractError extends Error {
  txid: string;
  status: number;
  constructor(msg: string, txid: string, status: number) {
    super(msg);
    Object.setPrototypeOf(this, ContractError.prototype);
    this.name = "TransactionErrors";
    this.txid = txid;
    this.status = status;
  }
}

export const getRetryAction = (err: unknown): RetryAction => {
  if (isDuplicateTransactionError(err) || err instanceof ContractError) {
    return RetryAction.None;
  } else if (err instanceof TimeoutError) {
    return RetryAction.WithExistingTransactionId;
  }
  return RetryAction.WithNewTransactionId;
};

const matchNeedAdminPrivilege = (msg: string): string | null => {
  const messageMatch = msg.match(/Need Admin \w*/g);
  if (messageMatch !== null) {
    return messageMatch[0];
  }
  return null;
};

export class NeedAdminPrivilegeError extends ContractError {
  constructor(msg: string, txid: string, status: number) {
    super(msg, txid, status);
    Object.setPrototypeOf(this, NeedAdminPrivilegeError.prototype);
    this.name = "NeedAdminPrivilegeError";
  }
}

const MatchAssetNotExist = (msg: string): string | null => {
  const messageMatch = msg.match(/([tT]he )?[aA]sset \w* does not exist/g);
  if (messageMatch !== null) {
    return messageMatch[0];
  }
  return null;
};

export class AssetNotExist extends ContractError {
  constructor(msg: string, txid: string, status: number) {
    super(msg, txid, status);
    Object.setPrototypeOf(this, AssetNotExist.prototype);
    this.name = "AssetNotExist";
  }
}

const MatchFunctionNotExist = (msg: string): string | null => {
  const messageMatch = msg.match(
    /You've asked to invoke a function that does not exist: \w*/g
  );
  if (messageMatch !== null) {
    return messageMatch[0];
  }
  return null;
};
export class FunctionNotExist extends ContractError {
  constructor(msg: string, txid: string, status: number) {
    super(msg, txid, status);
    Object.setPrototypeOf(this, FunctionNotExist.prototype);
    this.name = "FunctionNotExist";
  }
}

const MatchUnauthorizedAccessBallot = (msg: string): string | null => {
  const messageMatch = msg.match(/You dont have access to read Ballot \w*/g);
  if (messageMatch !== null) {
    return messageMatch[0];
  }

  return null;
};

export class UnauthorizedAccessBallot extends ContractError {
  constructor(msg: string, txid: string, status: number) {
    super(msg, txid, status);
    Object.setPrototypeOf(this, UnauthorizedAccessBallot.prototype);
    this.name = "UnauthorizedAccessBallot";
  }
}

const MatchNoValidResponsePeer = (msg:string):string|null => {
  const msgremovline = msg.replace(/(\r\n|\n|\r)/gm, "");
  const messageMatch = msgremovline.match(/(No valid responses from any peers.*)/g)
  if(messageMatch!==null){
    const errMsg = messageMatch[0].match(/(message=)(.*)/)![2];
    return errMsg
  }

  return null;
}


export class NoValidResponsePeerError extends ContractError{
  constructor(msg:string, txid:string, status:number){
    super(msg,txid,status);
    Object.setPrototypeOf(this, NoValidResponsePeerError.prototype);
    this.name  = "NoValidResponsePeerError"
  }
}

export function handleError(txid: string, err: unknown): Error | unknown {
  if (isErrorLike(err)) {
    const needAdminMatch = matchNeedAdminPrivilege(err.message);
    if (matchNeedAdminPrivilege(err.message) !== null) {
      return new NeedAdminPrivilegeError(needAdminMatch as string, txid, 403);
    }

    const matchAssetNotExist = MatchAssetNotExist(err.message);
    if (matchAssetNotExist !== null) {
      return new AssetNotExist(matchAssetNotExist, txid, 404);
    }

    const matchFunctionNotExist = MatchFunctionNotExist(err.message);
    if (matchAssetNotExist !== null) {
      return new FunctionNotExist(matchFunctionNotExist as string, txid, 404);
    }

    const matchUnauthorizedAccessBallot = MatchUnauthorizedAccessBallot(
      err.message
    );
    if (matchUnauthorizedAccessBallot !== null) {
      return new UnauthorizedAccessBallot(matchUnauthorizedAccessBallot, txid, 403);
    }
    
    //Native Invoke
    const matchNoValidResponsePeer = MatchNoValidResponsePeer(err.message);
    if(matchNoValidResponsePeer!==null){
      return new NoValidResponsePeerError(matchNoValidResponsePeer,txid, 400);
    }
  }
  return err;
}

export class FabricCAError extends Error {
  status: number;
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, FabricCAError.prototype);
    this.name = "FabricCAError";
    this.status = 401;
  }
}

export function handleFabricCAError(err: unknown): Error | unknown {
  if (isErrorLike(err)) {
    return new FabricCAError(err.message);
  }
  return err;
}

export class JobNotFoundError extends Error {
  jobId: string;

  constructor(message: string, jobId: string) {
    super(message);
    Object.setPrototypeOf(this, JobNotFoundError.prototype);
    this.name = 'JobNotFoundError';
    this.jobId = jobId;
  }
}