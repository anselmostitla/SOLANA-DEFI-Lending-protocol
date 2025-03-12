import * as anchor from "@coral-xyz/anchor";
import { Lending } from "../target/types/lending";
import { BankrunProvider } from "anchor-bankrun";
import { expect } from "chai";

import {
   AccountInfoBytes, AddedAccount, BanksClient, BanksTransactionResultWithMeta, ProgramTestContext, startAnchor
} from "solana-bankrun";

import {
   createAccount, createMint, mintTo
} from "spl-token-bankrun";

import {
   Connection, PublicKey, Keypair, Transaction, TransactionInstruction, clusterApiUrl,
   LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";

import {
   // createMint, mintTo, getOrCreateAssociatedTokenAccount, Account, createTransferInstruction, 
   TOKEN_PROGRAM_ID 
} from "@solana/spl-token";

const IDL = require("../target/idl/lending.json");

// Constants
const PROJECT_DIRECTORY = ""; // Leave empty if using default anchor project
const USDC_DECIMALS = 6;
const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MINIMUM_SLOT = 100;
const MINIMUM_USDC_BALANCE = 100_000_000_000; // 100k USDC

// Create a new connection object ()
const networks = ['http://localhost:8899', clusterApiUrl('testnet'), 'https://api.devnet.solana.com', 'mainnet-beta']
const connection = new Connection((networks[0]), 'confirmed');


describe("Bankrun Lending", () => {
   // Boiler plate variables
   let context: ProgramTestContext;
   let provider: BankrunProvider;
   let program: anchor.Program<Lending>;
   let banksClient: BanksClient;

   let payer: anchor.web3.Keypair;
   let mintSol: anchor.web3.PublicKey;
   let mintUsdc: anchor.web3.PublicKey;
   let bankPda: anchor.web3.PublicKey;
   let bankTokenAccountPda: anchor.web3.PublicKey;

   // Input params
   let liquidationThreshold = new anchor.BN(2);
   let maxLtv = new anchor.BN(1);
   let interest_rate = new anchor.BN(5);

   let numTest = 0

   before(async() => {
      // Boiler plate variables
      context = await startAnchor(PROJECT_DIRECTORY, [], []);
      provider = new BankrunProvider(context);
      anchor.setProvider(provider);
      program = new anchor.Program<Lending>(IDL as Lending, provider);
      banksClient = context.banksClient;
   
      payer = provider.wallet.payer;
      // richPerson = Keypair.generate();
      console.log("payer: ", payer);

      // Create a new mint
      mintSol = await createMint(
         banksClient, // connection
         payer, // fee payer (pg.wallet.keypair)
         payer.publicKey, // mint authority and owner
         payer.publicKey, // freeze authority (you can use `null` to disable it. when you disable it, you can't turn it on again)
         9 // decimals
      );
      console.log("mintSol: ", mintSol);
      
      // Derive PDAs
      [bankPda] = anchor.web3.PublicKey.findProgramAddressSync(
         [mintSol.toBuffer()],
         program.programId
      );
      console.log("bankPda: ", bankPda);

      [bankTokenAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
         [Buffer.from("treasury"), mintSol.toBuffer()],
         program.programId
      )
      console.log("bankTokenAccountPda: ", bankTokenAccountPda);

   })

   beforeEach(async() => {
      numTest += 1
      console.log("beforeEach numTest: ", numTest);
   })

   it("Init Bank", async() => {
      await program.methods
         .initBank(liquidationThreshold, maxLtv, interest_rate)
         .accounts({
            signer: payer.publicKey, 
            mint: mintSol,
            bank: bankPda,
            bankTokenAccount: bankTokenAccountPda, 
            tokenProgram: TOKEN_PROGRAM_ID,
         })
         .signers([payer])
         .rpc()

      const bankInfo = await program.account.bank.fetch(bankPda)
      expect(bankInfo.liquidationThreshold.toNumber()).to.be.equal(liquidationThreshold.toNumber());
      expect(bankInfo.maxLtv.toNumber()).to.be.equal(maxLtv.toNumber());
      console.log("interest_rate: ", bankInfo.maxLtv.toNumber(), interest_rate.toNumber());
   })

   it("Two", async() => {
      console.log("Two");

      numTest += 1
      console.log("Two numTest: ", numTest);
   })

})