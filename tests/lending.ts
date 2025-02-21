import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lending } from "../target/types/lending";



import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("lending", () => {
  // Configure the client to use the local cluster.
  const pg = anchor.AnchorProvider.local()
  anchor.setProvider(pg);

  const program = anchor.workspace.Lending as Program<Lending>;

  async function signer() {
    const signer = anchor.web3.Keypair.generate()

    const airdropSignature = await pg.connection.requestAirdrop(
      signer.publicKey,
      10*anchor.web3.LAMPORTS_PER_SOL
    )
    await pg.connection.confirmTransaction(airdropSignature)
    console.log(await pg.connection.getBalance(signer.publicKey));

    return signer;
  }
  
  

  let mint: anchor.web3.PublicKey

  it("Is initialized!", async () => {
    const signer1 = await signer()

    mint = await createMint(
      pg.connection, // connection
      signer1, // fee payer (pg.wallet.keypair)
      pg.wallet.publicKey, // mint authority
      pg.wallet.publicKey, // freeze authority (you can use `null` to disable it. when you disable it, you can't turn it on again)
      8 // decimals
    );

    console.log("Creating bankPda....")
    await program.methods
    .initBank(new anchor.BN(1), new anchor.BN(1))
    .accounts({
      mint: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
    console.log("Created bankPda....")
  });
});
