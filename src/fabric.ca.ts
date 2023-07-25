import { handleError, handleFabricCAError } from "./utils/errors.js";
import FabricCAServices, { IKeyValueAttribute, IServiceResponse } from "fabric-ca-client";
// import FabricCAClient from "fabric-ca-client";
import ccpFile from "./connection/ccp.json" assert { type: "json" };
import { Identity, IdentityProvider, Wallet, Wallets } from "fabric-network";
function caConnect() {
  const ccp: Record<string, any> = ccpFile;
  const caInfo = ccp.certificateAuthorities["localhost"];
  const cacerts = caInfo.CACerts.pem;
  const caClient = new FabricCAServices(caInfo.url, {
    trustedRoots: cacerts,
    verify: false,
  }, caInfo.caName);
  return caClient;

}

export async function enrollUser(userID: string, userSecret: string): Promise<object> {
  try {
    const caClient = caConnect();
    const enrollment = await caClient.enroll({
      enrollmentID: userID,
      enrollmentSecret: userSecret,
    });

    return enrollment;
  } catch (err) {
    throw handleFabricCAError(err);
  }
}

export async function registerUser(
  userHash: string,
  electionID: string,
  uid: string
): Promise<string> {
  const caClient = caConnect();
  const [provider, wallet] = await _getProvider(uid);

  try {
    const registrarCtx = await provider.getUserContext(wallet, uid);
    const register = await caClient.register(
      {
        enrollmentID: userHash,
        enrollmentSecret: userHash,
        role: "client",
        affiliation: "",
        attrs: [
          {
            name: "ElectionID",
            value: electionID,
          },
        ],
        maxEnrollments: -1,
      },
      registrarCtx
    );
    return register;
  } catch (err) {
    return "Error";
  }
}
export async function getAllIdentities(uid: string): Promise<any> {
  const caClient = caConnect();
  const [provider, wallet] = await _getProvider(uid);
  const registrarCtx = await provider.getUserContext(wallet, uid);
  try {
    const ids = caClient.newIdentityService();
    const identityList = await ids.getAll(registrarCtx);
    return identityList;

  } catch (e: any) {
    if (e.errors[0].message) return e.errors[0].message;
    else return "Error";
  }
}

export async function getIdentitesById(uid: string, enrollmentID: string): Promise<any> {

  const caClient = caConnect();
  const [provider, wallet] = await _getProvider(uid);
  const registrarCtx = await provider.getUserContext(wallet, uid);

  try {
    const ids = caClient.newIdentityService();
    const identityList = await ids.getOne(enrollmentID, registrarCtx)
    return identityList;

  } catch (e: any) {
    if (e.errors[0].message) return e.errors[0].message;
    else return "Error";
  }
}

export async function deleteIdentity(uid: string, enrollmentID: string): Promise<any> {

  const caClient = caConnect();
  const [provider, wallet] = await _getProvider(uid);
  const registrarCtx = await provider.getUserContext(wallet, uid);

  try {
    const ids = caClient.newIdentityService();
    const deleteUser = await ids.delete(enrollmentID,registrarCtx);
    return deleteUser;

  } catch (e: any) {
    if (e.errors[0].message) return e.errors[0].message;
    else return "Error";
  }
}

async function _getProvider(
  uid: string
): Promise<[IdentityProvider, Identity]> {
  const tempwallet: Wallet = await Wallets.newFileSystemWallet(
    "./connection/_wallet"
  );
  const currentWallet = (await tempwallet.get(uid)) as Identity;
  const provider = tempwallet
    .getProviderRegistry()
    .getProvider(currentWallet?.type as string);
  return [provider, currentWallet];
}

