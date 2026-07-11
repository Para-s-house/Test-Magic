use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

pub const POAP_SEED: &[u8] = b"poap";
pub const CONFIG_SEED: &[u8] = b"config";

// ---------------------------------------------------------------------------
// MagicBlock — Delegation Program (on-chain constant)
// DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh
// ---------------------------------------------------------------------------

pub const DELEGATION_PROGRAM_ID: Pubkey =
    Pubkey::from_str_const("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

// ---------------------------------------------------------------------------
// Default ER Validator — Devnet Asia
// MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57
// ---------------------------------------------------------------------------

pub const DEFAULT_ER_VALIDATOR: Pubkey =
    Pubkey::from_str_const("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/// Maximum length of the token URI string stored on-chain.
pub const MAX_URI_LEN: usize = 256;

/// Maximum GPS distance (in meters) allowed between user and POI.
pub const MAX_DISTANCE_METERS: f64 = 150.0;

/// Price of the business POAP promo in lamports (0.1 SOL = 100_000_000 lamports).
pub const BUSINESS_PROMO_PRICE_LAMPORTS: u64 = 100_000_000;