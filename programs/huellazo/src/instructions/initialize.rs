use anchor_lang::prelude::*;

use crate::{constants::*, state::ConfigState};

// ---------------------------------------------------------------------------
// Initialize — Configuración global del programa
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + ConfigState::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, ConfigState>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(ctx: Context<Initialize>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.payer.key();
    config.total_minted = 0;
    config.bump = ctx.bumps.config;

    msg!("Huellazo: Config inicializada por {}", ctx.accounts.payer.key());
    Ok(())
}