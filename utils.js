const sdk = require('stellar-sdk');

const server = new sdk.Server(process.env.STELLAR_URL || 'https://horizon-testnet.stellar.org');

const handleError = (e) => {
  const detail = e.response?.detail || 'No details';
  const code = e.response?.status || '500';
  const response = {
    statusCode: code,
    errorMessage: `${e.message} - ${detail}` || 'Unknown Error',
  };
  return response;
};

const createTestnetAccount = async () => {
  const pair = sdk.Keypair.random();
  await server.friendbot(pair.publicKey()).call();
  return { 
      publicKey: pair.publicKey(), 
      privateKey: pair.secret() 
    };
};

const createAccount = async () => {
  const network = process.env.NETWORK || 'TESTNET';
  const createAcct = {
    TESTNET: createTestnetAccount,
  };
  const account = await createAcct[network]();
  return account;
};


const payTo = async (transaction, signingKey) => {
  const { origin, destination, amount, asset = sdk.Asset.native()} = transaction;
  try {
    const sourceKeypair = sdk.Keypair.fromSecret(signingKey);
    const account = await server.loadAccount(origin);

    const fee = await server.fetchBaseFee();
    const env = process.env.NETWORK || 'TESTNET'; // PUBLIC for Prod,

    const transaction = new sdk.TransactionBuilder(account, {
      fee,
      networkPassphrase: sdk.Networks[env],
    })
      .addOperation(sdk.Operation.payment({
        destination,
        asset,
        amount,
      }))
      .setTimeout(100)
      .build();
    transaction.sign(sourceKeypair);
    
    const transactionResult = await server.submitTransaction(transaction);

    const { id } = transactionResult;
    return {
      id,
      statusCode: 200,
      errorMessage: 'No error',
    };
  } catch (e) {
    return handleError(e);
  }
};

const trustAsset = async (assetName, limit, secret) => {
    const sourceKeypair = sdk.Keypair.fromSecret(secret);
    const account = await server.loadAccount(origin);
    const fee = await server.fetchBaseFee();
    const env = process.env.NETWORK || 'TESTNET'; // PUBLIC for Prod,
    
    const asset = new sdk.Asset(assetName, process.env.ISSUER_PUBLIC_KEY)

    const transaction = new sdk.TransactionBuilder(account, {
      fee,
      networkPassphrase: sdk.Networks[env],
    })
      .addOperation(sdk.Operation.changeTrust({
        source: sourceKeypair.publicKey(),
        asset,
        limit
      }))
      .setTimeout(100)
      .build();
    transaction.sign(sourceKeypair);
};

const mintWordToken = async (word) => 
    await trustAsset(word, 1, process.env.DISTRIBUTION_SECRET);

// Opens Trustline for word then pays to account
const sendWordToExistingAccount = async (secret, word) => {
    const keypair = sdk.Keypair.fromSecret(secret);
    await trustAsset(word, 1, keypair.secret());
        await payTo({
        origin: process.env.DISTRIBUTION_PUBLIC_KEY, 
        destination: keypair.publicKey(), 
        amount: 1, 
        asset: word
    });
};

// Creates Account, Opens Trustline for word then pays to account
const sendWordToNewAccount = async (word) => {
    const { publicKey, privateKey } = await createAccount();
    await trustAsset(word, 1, privateKey);
    await payTo({
        origin: process.env.DISTRIBUTION_PUBLIC_KEY, 
        destination: publicKey, 
        amount: 1, 
        asset: word
    });
};




//  Payment operation with Dist as destination, asset name, amount intended to generate (Signed by Issuer)

module.exports = {
  payTo,
  createAccount,
  mintWordToken,
  sendWordToNewAccount,
};
