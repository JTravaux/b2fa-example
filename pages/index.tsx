import WalletConnectProvider from '@walletconnect/web3-provider'
import { providers } from 'ethers'
import Head from 'next/head'
import { useCallback, useEffect, useReducer, useState } from 'react'
import WalletLink from 'walletlink'
import Web3Modal from 'web3modal'
import { ellipseAddress, getChainData } from '../lib/utilities'
import axios from 'axios'

const INFURA_ID = '460f40a260564ac4a4f4b3fffb032dad'

const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider, // required
    options: {
      infuraId: INFURA_ID, // required
    },
  },
  // 'custom-walletlink': {
  //   display: {
  //     logo: 'https://play-lh.googleusercontent.com/PjoJoG27miSglVBXoXrxBSLveV6e3EeBPpNY55aiUUBM9Q1RCETKCOqdOkX2ZydqVf0',
  //     name: 'Coinbase',
  //     description: 'Connect to Coinbase Wallet (not Coinbase App)',
  //   },
  //   options: {
  //     appName: 'Coinbase', // Your app name
  //     networkUrl: `https://mainnet.infura.io/v3/${INFURA_ID}`,
  //     chainId: 1,
  //   },
  //   package: WalletLink,
  //   connector: async (_, options) => {
  //     const { appName, networkUrl, chainId } = options
  //     const walletLink = new WalletLink({
  //       appName,
  //     })
  //     const provider = walletLink.makeWeb3Provider(networkUrl, chainId)
  //     await provider.enable()
  //     return provider
  //   },
  // },
}

let web3Modal
if (typeof window !== 'undefined') {
  web3Modal = new Web3Modal({
    network: 'mainnet', // optional
    cacheProvider: true,
    providerOptions, // required
  })
}

type StateType = {
  provider?: any
  web3Provider?: any
  address?: string
  chainId?: number
}

type ActionType =
  | {
      type: 'SET_WEB3_PROVIDER'
      provider?: StateType['provider']
      web3Provider?: StateType['web3Provider']
      address?: StateType['address']
      chainId?: StateType['chainId']
    }
  | {
      type: 'SET_ADDRESS'
      address?: StateType['address']
    }
  | {
      type: 'SET_CHAIN_ID'
      chainId?: StateType['chainId']
    }
  | {
      type: 'RESET_WEB3_PROVIDER'
    }

const initialState: StateType = {
  provider: null,
  web3Provider: null,
  address: null,
  chainId: null,
}

function reducer(state: StateType, action: ActionType): StateType {
  switch (action.type) {
    case 'SET_WEB3_PROVIDER':
      return {
        ...state,
        provider: action.provider,
        web3Provider: action.web3Provider,
        address: action.address,
        chainId: action.chainId,
      }
    case 'SET_ADDRESS':
      return {
        ...state,
        address: action.address,
      }
    case 'SET_CHAIN_ID':
      return {
        ...state,
        chainId: action.chainId,
      }
    case 'RESET_WEB3_PROVIDER':
      return initialState
    default:
      throw new Error()
  }
}

export const Home = (): JSX.Element => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [status, setStatus] = useState('Waiting for login...')
  const [b2faAddress, setB2faAddress] = useState(
    '0x11D71baa4AB419a28bA43D218C0F4657b892D26f'
  )

  const [state, dispatch] = useReducer(reducer, initialState)
  const { provider, web3Provider, address, chainId } = state

  const connect = useCallback(async function () {
    // This is the initial `provider` that is returned when
    // using web3Modal to connect. Can be MetaMask or WalletConnect.
    const provider = await web3Modal.connect()

    // We plug the initial `provider` into ethers.js and get back
    // a Web3Provider. This will add on methods from ethers.js and
    // event listeners such as `.on()` will be different.
    const web3Provider = new providers.Web3Provider(provider)

    const signer = web3Provider.getSigner()
    const address = await signer.getAddress()

    const network = await web3Provider.getNetwork()

    dispatch({
      type: 'SET_WEB3_PROVIDER',
      provider,
      web3Provider,
      address,
      chainId: network.chainId,
    })
  }, [])

  const disconnect = useCallback(
    async function () {
      await web3Modal.clearCachedProvider()
      if (provider?.disconnect && typeof provider.disconnect === 'function') {
        await provider.disconnect()
      }

      if (loggedIn) setLoggedIn(false)

      setStatus('Waiting for login...')
      dispatch({
        type: 'RESET_WEB3_PROVIDER',
      })
    },
    [provider]
  )

  // Auto connect to the cached provider
  useEffect(() => {
    if (web3Modal.cachedProvider) {
      connect()
    }
  }, [connect])

  // A `provider` should come with EIP-1193 events. We'll listen for those events
  // here so that when a user switches accounts or networks, we can update the
  // local React state with that new information.
  useEffect(() => {
    if (provider?.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        // eslint-disable-next-line no-console
        console.log('accountsChanged', accounts)

        if (!loggedIn) setStatus('Waiting for login...')
        else setStatus('Waiting for b2fa authorization...')

        dispatch({
          type: 'SET_ADDRESS',
          address: accounts[0],
        })
      }

      // https://docs.ethers.io/v5/concepts/best-practices/#best-practices--network-changes
      const handleChainChanged = (_hexChainId: string) => {
        window.location.reload()
      }

      const handleDisconnect = (error: { code: number; message: string }) => {
        // eslint-disable-next-line no-console
        console.log('disconnect', error)
        disconnect()
      }

      provider.on('accountsChanged', handleAccountsChanged)
      provider.on('chainChanged', handleChainChanged)
      provider.on('disconnect', handleDisconnect)

      // Subscription Cleanup
      return () => {
        if (provider.removeListener) {
          provider.removeListener('accountsChanged', handleAccountsChanged)
          provider.removeListener('chainChanged', handleChainChanged)
          provider.removeListener('disconnect', handleDisconnect)
        }
      }
    }
  }, [provider, disconnect])

  const chainData = getChainData(chainId)

  const handleLogin = () => {
    if (username === 'JackJeff' && password === 'GoodPassword123') {
      console.log('Logged in!')
      setLoggedIn(true)
      setStatus('Waiting for b2fa authorization...')
    } else setStatus('Invalid username or password')
  }

  const handleSignMessage = async () => {
    console.log({
      provider,
      web3Provider,
    })

    const message = `Please complete B2FA verification for: ${address}`
    provider.sendAsync(
      {
        method: 'personal_sign',
        params: [message, address],
      },
      async (err, { result }) => {
        if (err) {
          console.error(err)
        }

        try {
          const res = await axios.post('/api/verify', {
            message,
            signature: result,
          })

          console.log(res.data)

          if (res.data.address === b2faAddress) setStatus('B2FA verified!')
          else
            setStatus(
              'B2FA verification failed! You are not the account owner, or you are using the incorrect B2FA address.'
            )
        } catch (err) {
          console.log(err)
        }
      }
    )
  }

  return (
    <div className="container">
      <Head>
        <title>Proof of Concept - B2FA</title>
        <link rel="icon" href="/b2fa_icon.png" />
      </Head>

      <main>
        <h1 className="title">B2FA Example</h1>
        <h2 className="subtitle">
          {loggedIn ? 'Please verify with B2FA' : 'Login to get started'}
        </h2>
        <h6 className="noMargin">Username: JackJeff</h6>
        <h6 className="noMargin">Password: GoodPassword123</h6>
        <br />

        {web3Provider && (
          <>
            <h6 className="noMargin">Network: {chainData?.name}</h6>
            <h6 className="noMargin">
              Connected Address:{' '}
              <span className="fail-success">{ellipseAddress(address, 5)}</span>
            </h6>
            <br />
          </>
        )}
        <h6 className="noMargin">{status}</h6>
        <br />

        {!loggedIn ? (
          <div className="login">
            <input
              type="text"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
            <br />
            <input
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <br />
            <br />
            <button className="button" type="button" onClick={handleLogin}>
              Login
            </button>
          </div>
        ) : (
          <div>
            {web3Provider ? (
              <>
                {status !== 'B2FA verified!' && (
                  <button
                    className="button"
                    type="button"
                    onClick={handleSignMessage}
                  >
                    Sign Message
                  </button>
                )}
                <br />
                <br />
                <button
                  className="disconnect"
                  type="button"
                  onClick={disconnect}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button className="button" type="button" onClick={connect}>
                Connect Wallet
              </button>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        main {
          padding: 5rem 0;
          text-align: center;
        }

        p {
          margin-top: 0;
        }

        .title {
          margin-bottom: 0;
        }

        .noMargin {
          margin: 0;
        }

        .subtitle {
          margin-top: 0;
          font-size: 1.5rem;
        }

        .login {
          margin-bottom: 1rem;
        }

        .container {
          padding: 2rem;
          margin: 0 auto;
          max-width: 1200px;
        }

        .status {
          font-size: 0.8rem;
          background: #f5f5f5;
          width: fit-content;
          margin: 1% auto;
        }

        .grid {
          display: grid;
          grid-template-columns: auto auto;
          justify-content: space-between;
        }

        .disconnect {
          padding: 1rem;
          background: red;
          border: none;
          border-radius: 0.5rem;
          color: #fff;
          font-size: 1rem;
          cursor: pointer;
        }
        .button {
          padding: 1rem 1.5rem;
          background: green;
          border: none;
          border-radius: 0.5rem;
          color: #fff;
          font-size: 1.2rem;
          cursor: pointer;
        }

        .mb-0 {
          margin-bottom: 0;
        }
        .mb-1 {
          margin-bottom: 0.25rem;
        }
        .fail-success {
          color: ${address?.toLowerCase() === b2faAddress.toLowerCase()
            ? 'green'
            : 'red'};
        }
      `}</style>

      <style jsx global>{`
        html,
        body {
          padding: 0;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
            Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue,
            sans-serif;
        }

        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  )
}

export default Home
