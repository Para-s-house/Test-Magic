use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("No estas lo suficientemente cerca del punto de interes para reclamar este Huellazo")]
    TooFarFromPOI,

    #[msg("El ID del token ya existe — el poap ya fue minteado")]
    TokenIdAlreadyExists,

    #[msg("La URI del token excede la longitud maxima permitida")]
    UriTooLong,

    #[msg("El pago no coincide con el precio de la promocion del negocio")]
    InvalidPaymentAmount,

    #[msg("Solo el administrador del config puede realizar esta accion")]
    Unauthorized,

    #[msg("La cuenta no esta delegada a MagicBlock")]
    NotDelegated,

    #[msg("La latitud o longitud proporcionada no es valida")]
    InvalidCoordinates,
}