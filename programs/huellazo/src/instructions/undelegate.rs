use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

// ---------------------------------------------------------------------------
// Undelegate — Commit + Devolver propiedad de la PDA al programa
// ---------------------------------------------------------------------------
// `commit_and_undelegate` hace dos cosas atómicamente:
//   1. Sincroniza el estado final del ER a la capa base (commit).
//   2. Devuelve la propiedad de la PDA del Delegation Program al programa
//      Huellazo (undelegate).
//
// El callback de undelegation es inyectado automáticamente por el macro
// `#[ephemeral]` del programa principal. Su discriminator es:
//   [196, 28, 41, 206, 48, 37, 51, 167]
//
// Esta instrucción se ejecuta en el EPHEMERAL ROLLUP.
// ---------------------------------------------------------------------------

#[commit]
#[derive(Accounts)]
pub struct UndelegateInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: La PDA delegada que se quiere undelegar.
    #[account(mut)]
    pub poap: UncheckedAccount<'info>,
}

pub fn handle_undelegate(ctx: Context<UndelegateInput>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.poap.to_account_info()])
    .build_and_invoke()?;

    msg!(
        "Huellazo: PDA {} undelegada — propiedad devuelta al programa",
        ctx.accounts.poap.key()
    );
    Ok(())
}