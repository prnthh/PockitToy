# PockitToy
The most swag toy in existence.

PockitToy is an iframe-based identity provider for websites.

WARNING: This project is unaudited. We do not recommend using PockitToy to store valuable assets; its intended use is as a simple identity management system to be embedded in game clients.

On first launch, we generate a unique 64-character private key that is used to sign messages and transactions. The goal is to build a secure, persistent enclave for keys that is agnostic to blockchain implementations.

This key is used to sign transactions internally, using Viem or any other blockchain framework to perform chain-specific read and write operations. There is no internal concept of wallet balance — that is up to apps to implement.

By including the PockitToy iframe in an existing web app, the app can securely communicate with the wallet via window events to access identity, perform signing and verification, and use address-book functions provided by the wallet.

Browser sandboxing of iframes ensures that sensitive user data is only accessible to the trusted domain where PockitToy is deployed: https://toy.pockit.world/.

After generating a key, the wallet adopts a unique visual appearance that the user can recognize, helping to prevent MITM or impersonation attacks — the user will notice if the wallet appearance differs from the usual one.