import resolve from 'did-resolver'
import register from 'ethr-did-resolver'
import EthrDID from '../index.js'
import Contract from 'truffle-contract'
import DidRegistryContract from 'ethr-did-registry'
import Web3 from 'web3'
import ganache from 'ganache-cli'
import { verifyJWT } from 'did-jwt'

function sleep (seconds) {
  return new Promise((resolve, reject) => setTimeout(resolve, seconds * 1000))
}

describe('ethrResolver', () => {
  const provider = ganache.provider()
  const DidReg = Contract(DidRegistryContract)
  const web3 = new Web3()
  web3.setProvider(provider)
  const getAccounts = () => new Promise((resolve, reject) => web3.eth.getAccounts((error, accounts) => error ? reject(error) : resolve(accounts)))
  DidReg.setProvider(provider)

  let ethrDid, plainDid, registry, accounts, did, identity, owner, delegate1, delegate2

  beforeAll(async () => {
    accounts = await getAccounts()
    identity = accounts[1]
    owner = accounts[2]
    delegate1 = accounts[3]
    delegate2 = accounts[4]
    did = `did:ethr:${identity}`

    registry = await DidReg.new({
      from: accounts[0],
      gasPrice: 100000000000,
      gas: 4712388
    })
    ethrDid = new EthrDID({provider, registry: registry.address, address: identity})
    register({provider, registry: registry.address})
  })

  describe('presets', () => {
    it('sets address', () => {
      expect(ethrDid.address).toEqual(identity)
    })

    it('sets did', () => {
      expect(ethrDid.did).toEqual(did)
    })
  })

  it('defaults to itself', () => {
    return expect(ethrDid.lookupOwner()).resolves.toEqual(identity)
  })

  describe('key management', () => {
    describe('owner changed', () => {
      beforeAll(async () => {
        await ethrDid.changeOwner(owner)
      })

      it('changes owner', () => {
        return expect(ethrDid.lookupOwner()).resolves.toEqual(owner)
      })

      it('resolves document', () => {
        return expect(resolve(did)).resolves.toEqual({
          '@context': 'https://w3id.org/did/v1',
          id: did,
          publicKey: [{
            id: `${did}#owner`,
            type: 'Secp256k1VerificationKey2018',
            owner: did,
            ethereumAddress: owner
          }],
          authentication: [{
            type: 'Secp256k1SignatureAuthentication2018',
            publicKey: `${did}#owner`
          }]
        })
      })
    })

    describe('delegates', () => {
      describe('add signing delegate', () => {
        beforeAll(async () => {
          await ethrDid.addDelegate(delegate1, {expiresIn: 2})
        })

        it('resolves document', () => {
          return expect(resolve(did)).resolves.toEqual({
            '@context': 'https://w3id.org/did/v1',
            id: did,
            publicKey: [{
              id: `${did}#owner`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: owner
            }, {
              id: `${did}#delegate-1`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: delegate1
            }],
            authentication: [{
              type: 'Secp256k1SignatureAuthentication2018',
              publicKey: `${did}#owner`
            }]
          })
        })
      })

      describe('add auth delegate', () => {
        beforeAll(async () => {
          await ethrDid.addDelegate(delegate2, {delegateType: 'Secp256k1SignatureAuthentication2018', expiresIn: 10})
        })

        it('resolves document', () => {
          return expect(resolve(did)).resolves.toEqual({
            '@context': 'https://w3id.org/did/v1',
            id: did,
            publicKey: [{
              id: `${did}#owner`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: owner
            }, {
              id: `${did}#delegate-1`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: delegate1
            }, {
              id: `${did}#delegate-2`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: delegate2
            }],
            authentication: [{
              type: 'Secp256k1SignatureAuthentication2018',
              publicKey: `${did}#owner`
            }, {
              type: 'Secp256k1SignatureAuthentication2018',
              publicKey: `${did}#delegate-2`
            }]
          })
        })
      })

      describe('expire automatically', () => {
        beforeAll(async () => {
          await sleep(3)
        })

        it('resolves document', () => {
          return expect(resolve(did)).resolves.toEqual({
            '@context': 'https://w3id.org/did/v1',
            id: did,
            publicKey: [{
              id: `${did}#owner`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: owner
            }, {
              id: `${did}#delegate-1`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: delegate2
            }],
            authentication: [{
              type: 'Secp256k1SignatureAuthentication2018',
              publicKey: `${did}#owner`
            }, {
              type: 'Secp256k1SignatureAuthentication2018',
              publicKey: `${did}#delegate-1`
            }]
          })
        })
      })

      describe('revokes delegate', () => {
        beforeAll(async () => {
          await ethrDid.revokeDelegate(delegate2, 'Secp256k1SignatureAuthentication2018')
        })

        it('resolves document', () => {
          return expect(resolve(did)).resolves.toEqual({
            '@context': 'https://w3id.org/did/v1',
            id: did,
            publicKey: [{
              id: `${did}#owner`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: owner
            }],
            authentication: [{
              type: 'Secp256k1SignatureAuthentication2018',
              publicKey: `${did}#owner`
            }]
          })
        })
      })

      describe('re-add auth delegate', () => {
        beforeAll(async () => {
          await ethrDid.addDelegate(delegate2, {delegateType: 'Secp256k1SignatureAuthentication2018'})
        })

        it('resolves document', () => {
          return expect(resolve(did)).resolves.toEqual({
            '@context': 'https://w3id.org/did/v1',
            id: did,
            publicKey: [{
              id: `${did}#owner`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: owner
            }, {
              id: `${did}#delegate-1`,
              type: 'Secp256k1VerificationKey2018',
              owner: did,
              ethereumAddress: delegate2
            }],
            authentication: [{
              type: 'Secp256k1SignatureAuthentication2018',
              publicKey: `${did}#owner`
            }, {
              type: 'Secp256k1SignatureAuthentication2018',
              publicKey: `${did}#delegate-1`
            }]
          })
        })
      })
    })

    describe('attributes', () => {
      describe('publicKey', () => {
        describe('Secp256k1VerificationKey2018', () => {
          beforeAll(async () => {
            await ethrDid.setAttribute('did/publicKey/Secp256k1VerificationKey2018', '0x02b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b71', 10)
          })

          it('resolves document', () => {
            return expect(resolve(did)).resolves.toEqual({
              '@context': 'https://w3id.org/did/v1',
              id: did,
              publicKey: [{
                id: `${did}#owner`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                ethereumAddress: owner
              }, {
                id: `${did}#delegate-1`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                ethereumAddress: delegate2
              }, {
                id: `${did}#delegate-2`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                publicKeyHex: '02b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b71'
              }],
              authentication: [{
                type: 'Secp256k1SignatureAuthentication2018',
                publicKey: `${did}#owner`
              }, {
                type: 'Secp256k1SignatureAuthentication2018',
                publicKey: `${did}#delegate-1`
              }]
            })
          })
        })

        describe('Base64 Encoded Key', () => {
          beforeAll(async () => {
            await ethrDid.setAttribute('did/publicKey/Ed25519VerificationKey2018/publicKeyBase64', 'Arl8MN52fwhM4wgBaO4pMFO6M7I11xFqMmPSnxRQk2tx', 10)
          })

          it('resolves document', () => {
            return expect(resolve(did)).resolves.toEqual({
              '@context': 'https://w3id.org/did/v1',
              id: did,
              publicKey: [{
                id: `${did}#owner`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                ethereumAddress: owner
              }, {
                id: `${did}#delegate-1`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                ethereumAddress: delegate2
              }, {
                id: `${did}#delegate-2`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                publicKeyHex: '02b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b71'
              }, {
                id: `${did}#delegate-3`,
                type: 'Ed25519VerificationKey2018',
                owner: did,
                publicKeyBase64: 'Arl8MN52fwhM4wgBaO4pMFO6M7I11xFqMmPSnxRQk2tx'
              }],
              authentication: [{
                type: 'Secp256k1SignatureAuthentication2018',
                publicKey: `${did}#owner`
              }, {
                type: 'Secp256k1SignatureAuthentication2018',
                publicKey: `${did}#delegate-1`
              }]
            })
          })
        })

        describe('Use Buffer', () => {
          beforeAll(async () => {
            await ethrDid.setAttribute('did/publicKey/Ed25519VerificationKey2018/publicKeyBase64', Buffer.from('f2b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b72', 'hex'), 10)
          })

          it('resolves document', () => {
            return expect(resolve(did)).resolves.toEqual({
              '@context': 'https://w3id.org/did/v1',
              id: did,
              publicKey: [{
                id: `${did}#owner`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                ethereumAddress: owner
              }, {
                id: `${did}#delegate-1`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                ethereumAddress: delegate2
              }, {
                id: `${did}#delegate-2`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                publicKeyHex: '02b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b71'
              }, {
                id: `${did}#delegate-3`,
                type: 'Ed25519VerificationKey2018',
                owner: did,
                publicKeyBase64: 'Arl8MN52fwhM4wgBaO4pMFO6M7I11xFqMmPSnxRQk2tx'
              }, {
                id: `${did}#delegate-4`,
                type: 'Ed25519VerificationKey2018',
                owner: did,
                publicKeyBase64: '8rl8MN52fwhM4wgBaO4pMFO6M7I11xFqMmPSnxRQk2ty'
              }],
              authentication: [{
                type: 'Secp256k1SignatureAuthentication2018',
                publicKey: `${did}#owner`
              }, {
                type: 'Secp256k1SignatureAuthentication2018',
                publicKey: `${did}#delegate-1`
              }]
            })
          })
        })
      })

      describe('service endpoints', () => {
        describe('HubService', () => {
          beforeAll(async () => {
            await ethrDid.setAttribute('did/service/HubService', 'https://hubs.uport.me', 10)
          })
          it('resolves document', () => {
            return expect(resolve(did)).resolves.toEqual({
              '@context': 'https://w3id.org/did/v1',
              id: did,
              publicKey: [{
                id: `${did}#owner`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                ethereumAddress: owner
              }, {
                id: `${did}#delegate-1`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                ethereumAddress: delegate2
              }, {
                id: `${did}#delegate-2`,
                type: 'Secp256k1VerificationKey2018',
                owner: did,
                publicKeyHex: '02b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b71'
              }, {
                id: `${did}#delegate-3`,
                type: 'Ed25519VerificationKey2018',
                owner: did,
                publicKeyBase64: Buffer.from('02b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b71', 'hex').toString('base64')
              }, {
                id: `${did}#delegate-4`,
                type: 'Ed25519VerificationKey2018',
                owner: did,
                publicKeyBase64: '8rl8MN52fwhM4wgBaO4pMFO6M7I11xFqMmPSnxRQk2ty'
              }],
              authentication: [{
                type: 'Secp256k1SignatureAuthentication2018',
                publicKey: `${did}#owner`
              }, {
                type: 'Secp256k1SignatureAuthentication2018',
                publicKey: `${did}#delegate-1`
              }],
              service: [{
                type: 'HubService',
                serviceEndpoint: 'https://hubs.uport.me'
              }]
            })
          })
        })
      })
    })
  })

  describe('signJWT', () => {
    describe('No signer configured', () => {
      it('should fail', () => {
        return expect(ethrDid.signJWT({hello: 'world'})).rejects.toEqual(new Error('No signer configured'))
      })
    })

    describe('creating a signing Delegate', () => {
      let kp
      beforeAll(async () => {
        kp = await ethrDid.createSigningDelegate()
      })

      it('resolves document', () => {
        return expect(resolve(did)).resolves.toEqual({
          '@context': 'https://w3id.org/did/v1',
          id: did,
          publicKey: [{
            id: `${did}#owner`,
            type: 'Secp256k1VerificationKey2018',
            owner: did,
            ethereumAddress: owner
          }, {
            id: `${did}#delegate-1`,
            type: 'Secp256k1VerificationKey2018',
            owner: did,
            ethereumAddress: delegate2
          }, {
            id: `${did}#delegate-2`,
            type: 'Secp256k1VerificationKey2018',
            owner: did,
            publicKeyHex: '02b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b71'
          }, {
            id: `${did}#delegate-3`,
            type: 'Ed25519VerificationKey2018',
            owner: did,
            publicKeyBase64: Buffer.from('02b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b71', 'hex').toString('base64')
          }, {
            id: `${did}#delegate-4`,
            type: 'Ed25519VerificationKey2018',
            owner: did,
            publicKeyBase64: '8rl8MN52fwhM4wgBaO4pMFO6M7I11xFqMmPSnxRQk2ty'
          }, {
            id: `${did}#delegate-5`,
            type: 'Secp256k1VerificationKey2018',
            owner: did,
            ethereumAddress: kp.address
          }],
          authentication: [{
            type: 'Secp256k1SignatureAuthentication2018',
            publicKey: `${did}#owner`
          }, {
            type: 'Secp256k1SignatureAuthentication2018',
            publicKey: `${did}#delegate-1`
          }],
          service: [{
            type: 'HubService',
            serviceEndpoint: 'https://hubs.uport.me'
          }]
        })
      })

      it('should sign valid jwt', () => {
        return ethrDid.signJWT({hello: 'world'}).then(jwt => verifyJWT(jwt).then(({payload, signer}) => expect(signer).toEqual({
          id: `${did}#delegate-5`,
          type: 'Secp256k1VerificationKey2018',
          owner: did,
          ethereumAddress: kp.address
        }), error => expect(error).toBeNull()))
      })
    })

    describe('plain vanilla keypair account', () => {
      it('should sign valid jwt', () => {
        const kp = EthrDID.createKeyPair()
        plainDid = new EthrDID({...kp, provider, registry: registry.address})
        plainDid.signJWT({hello: 'world'}).then(jwt => verifyJWT(jwt).then(({payload}) => expect(payload).toBeDefined(), error => expect(error).toBeNull()))
      })
    })
  })

  describe('verifyJWT', () => {
    it('verifies the signature of the JWT', () => {
      return ethrDid.signJWT({hello: 'friend'}).then(jwt => plainDid.verifyJWT(jwt)).then(({issuer}) => expect(issuer).toEqual(did))
    })

    describe('uses did for verifying aud claim', () => {
      it('verifies the signature of the JWT', () => {
        return ethrDid.signJWT({hello: 'friend', aud: plainDid.did}).then(jwt => plainDid.verifyJWT(jwt)).then(({issuer}) => expect(issuer).toEqual(did))
      })

      it('fails if wrong did', () => {
        return ethrDid.signJWT({hello: 'friend', aud: ethrDid.did}).then(jwt => plainDid.verifyJWT(jwt)).catch(error => expect(error.message).toEqual(`JWT audience does not match your DID: aud: ${ethrDid.did} !== yours: ${plainDid.did}`))
      })
    })
  })
})
