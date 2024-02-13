// Next, React
import { FC, useEffect, useState } from 'react';
import Link from 'next/link';
import { WalletAdapterNetwork, WalletError } from '@solana/wallet-adapter-base';
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Keypair, TransactionMessage, VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
// Wallet
import { createBurnCheckedInstruction, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { notify } from "../../utils/notifications";
// Components
import { RequestAirdrop } from '../../components/RequestAirdrop';
import pkg from '../../../package.json';
import { useRouter } from 'next/router';
// Store
import useUserSOLBalanceStore from '../../stores/useUserSOLBalanceStore';
import { NetworkConfigurationProvider, useNetworkConfiguration } from '../../contexts/NetworkConfigurationProvider';
//constants
const MINT_ADDRESS = "DGi43C8vkhDBqWRWo1u23iGR2aWkF4Hgpj2Uo8ZGbMwY"
// const MINT_ADDRESS = "brpN2phpDmaKFSfJR6wKktzdQWeMnCVcFDtUKHyCtFM"
const MINT_DECIMALS = 2; // Value for USDC-Dev from spl-token-faucet.com | replace with the no. decimals of mint you would like to burn


export const HomeView: FC = ({ }) => {
  const router = useRouter();
  const { networkConfiguration } = useNetworkConfiguration();
  const network = networkConfiguration as WalletAdapterNetwork;
  // const endpoint = () => clusterApiUrl(network)
  const wallet = useWallet();
  const [burnTrx, setBurnTrx] = useState("")
  const [supply, setSupply] = useState("")
  const [amount, setAmount] = useState("")
  const [connection, setConnection] = useState(null)
  const { connection: wconn } = useConnection();
  const [loading, setLoading] = useState(false)



  useEffect(() => {
    console.log("useEffect", network)
    if (network == "mainnet-beta") {
      if (wallet.publicKey) {
        console.log(wallet.publicKey.toBase58())
        // console.log("network mainnet", network)
        const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=78c69964-e500-4354-8f43-eec127b47bd7");
        setConnection(connection)

      }
    } else {
      if (wallet.publicKey) {
        console.log(wallet.publicKey.toBase58())
        // console.log("network devnet", network)
        const connection = wconn
        setConnection(connection)

      }
    }

  }, [wallet.publicKey, network])
  useEffect(() => {
    // console.log("totalSupply")
    if (connection) {
      // console.log("totalSupply")
      getTotalSupply()
      getUserSOLBalance(wallet.publicKey, connection)
    }

  }, [connection])


  const getTotalSupply = async () => {
    try {
      let totalSupply: any = await getMint(connection, new PublicKey(MINT_ADDRESS));
      console.log("totalSupply", totalSupply.supply.toString())
      totalSupply = Number(totalSupply.supply.toString()) / 100
      setSupply(totalSupply)
    } catch (error) {
      console.log('error', `MINT ADDRESS not found! ${error}`);

    }

    // return totalSupply
  }
  const getMintAuth = async () => {
    const mintAuthority = await getMint(connection, new PublicKey(MINT_ADDRESS));
    // console.log("mint auth",mintAuthority.mintAuthority.toString())
    return mintAuthority.mintAuthority.toString()
  }

  // connection
  const balance = useUserSOLBalanceStore((s) => s.balance)
  // console.log("first balance", balance);
  const { publicKey } = useWallet();
  // console.log(`wallet`, wallet.publicKey.toString());

  const burnTk = async () => {
    setLoading(true);
    setBurnTrx("")
    if (!connection) {
      notify({ type: 'error', message: `Wallet not connected!` });
      console.log('error', `not connected!`);
      setLoading(false);
      return;
    }
    if (!publicKey) {
      notify({ type: 'error', message: `Wallet not connected!` });
      console.log('error', `Send Transaction: Wallet not connected!`);
      setLoading(false);
      return;
    }
    let mintAuthority = (await getMintAuth()).toLowerCase()
    // console.log("mintAuthority wallet",mintAuthority)
    let conWal = wallet.publicKey.toString().toLowerCase()
    // console.log("connected wallet",conWal)
    if (mintAuthority !== conWal) {
      notify({ type: 'error', message: `Connected wallet is not mint authority` });
      console.log('error', `unauthorised to burn`);
      setLoading(false);
      return;
    }

    let signature = '';
    try {

      // Create instructions to send, in this case a simple transfer

      // Step 1 - Fetch Associated Token Account Address
      //  console.log(`Step 1 - Fetch Token Account`);
      const account = await getAssociatedTokenAddress(new PublicKey(MINT_ADDRESS), wallet.publicKey);
      //  console.log(`    ✅ - Associated Token Account Address: ${account.toString()}`);
      // Step 2 - Create Burn Instructions
      //  console.log(`Step 2 - Create Burn Instructions`);
      const burnIx = createBurnCheckedInstruction(
        account, // PublicKey of Owner's Associated Token Account
        new PublicKey(MINT_ADDRESS), // Public Key of the Token Mint Address
        wallet.publicKey, // Public Key of Owner's Wallet
        Number(amount) * (10 ** MINT_DECIMALS), // Number of tokens to burn
        MINT_DECIMALS // Number of Decimals of the Token Mint
      );
      //  console.log(`    ✅ - Burn Instruction Created`);  
      // Step 3 - Fetch Blockhash
      // console.log(`Step 3 - Fetch Blockhash`);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      // console.log(`    ✅ - Latest Blockhash: ${blockhash}`);
      // Step 4 - Assemble Transaction
      // console.log(`Step 4 - Assemble Transaction`);
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: [burnIx]
      }).compileToV0Message();
      const transaction = new VersionedTransaction(messageV0);
      const sig = await wallet.signTransaction(transaction)
      // transaction.sign([wallet]);
      // console.log(`    ✅ - Transaction Created and Signed`, sig);
      // Step 5 - Execute & Confirm Transaction 
      // console.log(`Step 5 - Execute & Confirm Transaction`);
      const txid = await connection.sendTransaction(sig);
      // console.log("    ✅ - Transaction sent to network");
      const confirmation = await connection.confirmTransaction({
        signature: txid,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight
      });
      if (confirmation.value.err) { throw new Error("    ❌ - Transaction not confirmed.") }
      console.log('🔥 SUCCESSFUL BURN!🔥', '\n', `https://explorer.solana.com/tx/${txid}?cluster=mainnet-beta`);
      setBurnTrx(`https://explorer.solana.com/tx/${txid}?cluster=mainnet-beta`)
      //  console.log(signature);
      await getTotalSupply()
      notify({ type: 'success', message: 'Transaction successful!', txid: signature });
      setLoading(false);
    } catch (error: any) {
      notify({ type: 'error', message: `Transaction failed!`, description: error?.message, txid: signature });
      console.log('error', `Transaction failed! ${error?.message}`, signature);
      setLoading(false);
      return;
    }
  }


  const { getUserSOLBalance } = useUserSOLBalanceStore()

  const onClick = () => {
    router.push("/")
  }


  return (

    <div className=" mx-auto p-4">
      <div className="flex flex-row justify-center">
        <button
          className="group w-40 m-2 btn animate-pulse bg-gradient-to-br from-indigo-500 to-fuchsia-500 hover:from-white hover:to-purple-300 text-black"
          onClick={onClick}
        >
          <div className=" group-disabled:block">
            Home
          </div>

        </button>

      </div>
      <div className="md:hero-content h-[500px] justify-around flex flex-col">
        <div className='mt-6'>
          {/* <div className='text-sm font-normal align-bottom text-right text-slate-600 mt-4'>v{pkg.version}</div> */}
          <h1 className="text-center text-3xl md:pl-12 font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-fuchsia-500 mb-4">
            Admin
          </h1>
        </div>

        <div className="flex flex-col justify-between h-[120px] relative group items-center">

          {/* <RequestAirdrop /> */}
          <h4 className="md:w-full text-2xl text-slate-300 my-2">

            <div className="flex flex-row justify-center">
              <div className='text-slate-600 mr-2'>
                Brick Phone {" "}
              </div>
              <div> Total Supply : {" "}
                {(supply || 0).toLocaleString()}
              </div>

            </div>
            {wallet &&
              <div className="flex flex-row justify-center">
                <div> Wallet Balance : {""}
                  {(balance || 0).toLocaleString()}
                </div>
                <div className='text-slate-600 ml-2'>
                  SOL
                </div>
              </div>
            }
          </h4>
          {/* burn token */}
          <input
            type='number'
            min={0}
            max={supply}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-type"
          >
          </input>
          <button
            disabled={loading}
            className=' w-[90px] h-[40px] shadow-sm shadow-gray-400 rounded-[10px]'
            onClick={() => burnTk()}>
            {loading ? "Burning ..." : "Burn"}
          </button>
        </div >
        <div className="text-center ">

          <p className="text-center ">
            {burnTrx &&
              <div className=' flex flex-col h-[150px] justify-around items-center'>
                <p className=' mb-[20px]'>View on explorer</p>
                <a href={burnTrx}><button className=' w-[90px] h-[40px] shadow-sm shadow-gray-400 rounded-[10px] bg-teal-500'>click</button>
                </a>
                <span>{`${burnTrx}`}</span>

              </div>}

          </p>
        </div>

      </div>
    </div>
  );
};
