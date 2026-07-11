// ===========================================================================
// Huellazo - Frontend Logic
// ===========================================================================
// Conecta al MagicBlock Devnet Router para enrutar transacciones
// automaticamente entre Solana L1 y Ephemeral Rollups.
// ===========================================================================

// ---------------------------------------------------------------------------
// Configuracion
// ---------------------------------------------------------------------------

const BACKEND_URL = "http://localhost:5000";

// MagicBlock Magic Router Devnet — enruta automaticamente a ER o L1
const MAGIC_ROUTER_RPC = "https://devnet-router.magicblock.app/";
const MAGIC_ROUTER_WS = "wss://devnet-router.magicblock.app/";

// Solana Devnet (capa base para delegacion)
const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";

// Programa Huellazo
const PROGRAM_ID = "4pioWVSCp5oSbxbeRbquccusTkvT6Z9B8jTg7j2XXNVk";

// ER Validator Devnet Asia
const ER_VALIDATOR = "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57";

// Seeds
const POAP_SEED = "poap";
const CONFIG_SEED = "config";

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------

let solanaWallet = null;
let walletPublicKey = null;
let magicRouterConnection = null;
let baseConnection = null;
let currentBusinessPayment = null;

// IDL del programa Huellazo (cargado desde el backend o embebido)
let programIdl = null;

// ---------------------------------------------------------------------------
// Inicializacion
// ---------------------------------------------------------------------------

async function init() {
    // Crear conexiones
    magicRouterConnection = new solanaWeb3.Connection(MAGIC_ROUTER_RPC, {
        wsEndpoint: MAGIC_ROUTER_WS,
        commitment: "confirmed",
    });
    baseConnection = new solanaWeb3.Connection(SOLANA_DEVNET_RPC, "confirmed");

    setStatus("Conectado a MagicBlock Devnet Router", "info");

    // Cargar IDL
    try {
        // El IDL se genera en target/idl/huellazo.json al compilar
        // Para el prototipo lo cargamos desde un endpoint o lo embebemos
        programIdl = await loadIdl();
    } catch (e) {
        console.warn("No se pudo cargar el IDL, usando modo simulacion", e);
        programIdl = null;
    }

    // Tabs
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Wallet
    document.getElementById("connect-btn").addEventListener("click", connectWallet);

    // GPS
    document.getElementById("refresh-loc").addEventListener("click", refreshGPS);

    // Cargar datos
    loadPOIs();
    loadBusinesses();

    // Check si Phantom esta disponible
    if (window.solana && window.solana.isPhantom) {
        setStatus("Phantom detectado. Conecta tu wallet para comenzar.", "info");
    } else {
        setStatus("Phantom no detectado. Instala Phantom para usar Huellazo.", "error");
    }
}

// ---------------------------------------------------------------------------
// IDL Loader
// ---------------------------------------------------------------------------

async function loadIdl() {
    // En produccion esto vendria de un archivo generado por anchor build
    // Para el prototipo, lo obtenemos desde el target o lo embebemos
    try {
        const resp = await fetch("/idl/huellazo.json");
        if (resp.ok) return await resp.json();
    } catch (e) { /* fallback */ }

    // Fallback: IDL minimo embebido para simulacion
    return null;
}

// ---------------------------------------------------------------------------
// Wallet Connection (Phantom)
// ---------------------------------------------------------------------------

async function connectWallet() {
    if (!window.solana || !window.solana.isPhantom) {
        setStatus("Instala la extension Phantom para continuar", "error");
        window.open("https://phantom.app/", "_blank");
        return;
    }

    try {
        const resp = await window.solana.connect();
        solanaWallet = window.solana;
        walletPublicKey = new solanaWeb3.PublicKey(resp.publicKey.toString());

        const shortAddr = `${resp.publicKey.toString().slice(0, 6)}...${resp.publicKey.toString().slice(-4)}`;
        document.getElementById("wallet-address").textContent = shortAddr;
        document.getElementById("connect-btn").textContent = "Desconectar";
        document.getElementById("connect-btn").onclick = disconnectWallet;

        setStatus(`Wallet conectada: ${shortAddr}`, "success");
    } catch (e) {
        setStatus("Error al conectar wallet: " + e.message, "error");
    }
}

function disconnectWallet() {
    if (window.solana) window.solana.disconnect();
    solanaWallet = null;
    walletPublicKey = null;
    document.getElementById("wallet-address").textContent = "";
    document.getElementById("connect-btn").textContent = "Conectar Wallet";
    document.getElementById("connect-btn").onclick = connectWallet;
    setStatus("Wallet desconectada", "info");
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function switchTab(tab) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add("active");
    document.getElementById(`tab-${tab}`).classList.add("active");
}

// ---------------------------------------------------------------------------
// VISTA A: TURISTA — GPS + POIs + Mint
// ---------------------------------------------------------------------------

async function loadPOIs() {
    try {
        const resp = await fetch(`${BACKEND_URL}/api/pois`);
        const pois = await resp.json();

        const container = document.getElementById("poi-list");
        container.innerHTML = "";

        pois.forEach(poi => {
            const item = document.createElement("div");
            item.className = "poi-item";
            item.dataset.poiId = poi.id;
            item.innerHTML = `
                <img src="${poi.image}" alt="${poi.name}">
                <div class="poi-info">
                    <h3>${poi.name}</h3>
                    <p>${poi.description}</p>
                    <span class="distance-badge" id="dist-${poi.id}">Calculando...</span>
                </div>
                <button class="btn-claim" id="claim-${poi.id}" disabled>
                    Reclamar Huellazo
                </button>
            `;
            container.appendChild(item);

            document.getElementById(`claim-${poi.id}`).addEventListener("click", () => {
                mintPlacePOAP(poi);
            });
        });

        refreshGPS();
    } catch (e) {
        document.getElementById("poi-list").innerHTML =
            `<p class="loading">Error cargando POIs. Asegurate de que el backend este corriendo.</p>`;
    }
}

async function refreshGPS() {
    const userLat = parseFloat(document.getElementById("currentLat").value);
    const userLon = parseFloat(document.getElementById("currentLong").value);

    if (isNaN(userLat) || isNaN(userLon)) {
        setStatus("Coordenadas GPS invalidas", "error");
        return;
    }

    setStatus("Verificando proximidad GPS...", "info");

    const poiItems = document.querySelectorAll(".poi-item");
    for (const item of poiItems) {
        const poiId = item.dataset.poiId;
        try {
            const resp = await fetch(`${BACKEND_URL}/api/validate-gps`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    latitude: userLat,
                    longitude: userLon,
                    poi_id: poiId,
                }),
            });
            const data = await resp.json();
            const badge = document.getElementById(`dist-${poiId}`);
            const btn = document.getElementById(`claim-${poiId}`);

            badge.textContent = `${data.distance_meters}m | ${data.poi_name}`;
            if (data.is_nearby) {
                badge.className = "distance-badge near";
                btn.disabled = false;
                btn.textContent = "Reclamar Huellazo";
            } else {
                badge.className = "distance-badge far";
                btn.disabled = true;
                btn.textContent = "Muy lejos";
            }
        } catch (e) {
            console.error("Error GPS:", e);
        }
    }

    setStatus("GPS actualizado", "success");
}

// ---------------------------------------------------------------------------
// Mint POAP de Lugar Turistico (Vista A)
// ---------------------------------------------------------------------------

async function mintPlacePOAP(poi) {
    if (!walletPublicKey) {
        setStatus("Conecta tu wallet primero", "error");
        return;
    }

    const btn = document.getElementById(`claim-${poi.id}`);
    btn.disabled = true;
    btn.textContent = "Minteando...";
    setStatus("Iniciando minteo de POAP en Ephemeral Rollup...", "info");

    try {
        // Generar token_id unico
        const tokenId = Date.now();

        // Obtener URI de metadatos desde el backend
        const metadataResp = await fetch(`${BACKEND_URL}/api/metadata/poi/${poi.id}`);
        const metadata = await metadataResp.json();
        const tokenUri = `${BACKEND_URL}/api/metadata/poi/${poi.id}`;

        // --- Construir transaccion ---
        const poapPda = solanaWeb3.PublicKey.findProgramAddressSync(
            [
            Buffer.from(POAP_SEED),
            walletPublicKey.toBuffer(),
            new BN(tokenId).toArrayLike(Buffer, "le", 8),
            ],
            new solanaWeb3.PublicKey(PROGRAM_ID)
        );

        const configPda = solanaWeb3.PublicKey.findProgramAddressSync(
            [Buffer.from(CONFIG_SEED)],
            new solanaWeb3.PublicKey(PROGRAM_ID)
        );

        // En un escenario real con Anchor + IDL:
        // const program = new anchor.Program(programIdl, programId, provider);
        // const tx = await program.methods
        //     .mintPlace(new anchor.BN(tokenId), tokenUri, poi.latitude, poi.longitude, 0)
        //     .accounts({
        //         payer: walletPublicKey,
        //         config: configPda[0],
        //         poap: poapPda[0],
        //         systemProgram: solanaWeb3.SystemProgram.programId,
        //     })
        //     .transaction();
        //
        // Pero para el prototipo con MagicBlock, construimos la tx manualmente
        // y la enviamos al Magic Router para que la enrute al ER.

        const ix = await buildMintPlaceInstruction(
            tokenId,
            tokenUri,
            poi.latitude,
            poi.longitude,
            0,
            poapPda[0],
            configPda[0]
        );

        const tx = new solanaWeb3.Transaction();
        tx.add(ix);
        tx.feePayer = walletPublicKey;

        // Obtener blockhash desde el Magic Router
        const { blockhash } = await magicRouterConnection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        // Firmar con Phantom
        const signedTx = await window.solana.signTransaction(tx);
        const txHash = await magicRouterConnection.sendRawTransaction(
            signedTx.serialize(),
            { skipPreflight: true }
        );

        setStatus(`POAP minteado! Tx: ${txHash.slice(0, 20)}...`, "success");

        showMintResult({
            type: "Lugar Turistico",
            poi_name: poi.name,
            token_id: tokenId,
            poap_pda: poapPda[0].toString(),
            tx_hash: txHash,
            metadata: metadata,
            latitude: poi.latitude,
            longitude: poi.longitude,
        });

        btn.textContent = "Reclamado!";
        btn.style.background = "var(--primary)";
        btn.style.color = "white";
    } catch (e) {
        console.error("Error minteo:", e);
        setStatus("Error al mintear POAP: " + e.message, "error");
        btn.disabled = false;
        btn.textContent = "Reintentar";
    }
}

function showMintResult(data) {
    const card = document.getElementById("mint-result-card");
    const result = document.getElementById("mint-result");
    card.classList.remove("hidden");

    result.innerHTML = `
        <div class="result-box">
            <p><strong>Tipo:</strong> ${data.type}</p>
            <p><strong>Lugar:</strong> ${data.poi_name}</p>
            <p><strong>Token ID:</strong> <code>${data.token_id}</code></p>
            <p><strong>POAP PDA:</strong> <code>${data.poap_pda}</code></p>
            <p><strong>Coordenadas:</strong> ${data.latitude}, ${data.longitude}</p>
            <p><strong>Tx Hash:</strong> <code>${data.tx_hash}</code></p>
            <p><strong>Metadata:</strong> <code>${JSON.stringify(data.metadata).slice(0, 120)}...</code></p>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// VISTA B: NEGOCIO — QR + Pago + Mint
// ---------------------------------------------------------------------------

async function loadBusinesses() {
    try {
        const resp = await fetch(`${BACKEND_URL}/api/businesses`);
        const businesses = await resp.json();

        const container = document.getElementById("business-list");
        container.innerHTML = "";

        businesses.forEach(biz => {
            const item = document.createElement("div");
            item.className = "business-item";
            item.dataset.bizId = biz.id;
            item.innerHTML = `
                <img src="${biz.image}" alt="${biz.name}">
                <div class="business-info">
                    <h3>${biz.name}</h3>
                    <p>${biz.description}</p>
                    <p><strong>Precio:</strong> ${(biz.price_lamports / 1e9).toFixed(2)} SOL</p>
                    <span class="distance-badge near" style="font-size:0.75rem;cursor:pointer;">
                        Ver QR de Pago
                    </span>
                </div>
            `;
            item.querySelector(".distance-badge").addEventListener("click", () => {
                showQR(biz);
            });
            container.appendChild(item);
        });
    } catch (e) {
        document.getElementById("business-list").innerHTML =
            `<p class="loading">Error cargando negocios. Asegurate de que el backend este corriendo.</p>`;
    }
}

async function showQR(biz) {
    const card = document.getElementById("qr-display-card");
    const display = document.getElementById("qr-display");
    card.classList.remove("hidden");

    // Obtener datos del QR desde el backend
    const resp = await fetch(`${BACKEND_URL}/api/business/${biz.id}/qr-data`);
    const paymentData = await resp.json();
    currentBusinessPayment = paymentData;

    // Mostrar QR como imagen
    const qrImg = document.createElement("img");
    qrImg.src = `${BACKEND_URL}/api/business/${biz.id}/qr`;
    qrImg.alt = "QR de pago";

    display.innerHTML = "";
    display.appendChild(qrImg);

    // Configurar boton de pago
    const payBtn = document.getElementById("pay-btn");
    payBtn.onclick = () => payAndMintBusiness(paymentData);
    payBtn.disabled = false;

    setStatus(`QR de ${biz.name} cargado. Lista para pagar.`, "info");
}

async function payAndMintBusiness(paymentData) {
    if (!walletPublicKey) {
        setStatus("Conecta tu wallet primero", "error");
        return;
    }

    const payBtn = document.getElementById("pay-btn");
    payBtn.disabled = true;
    payBtn.textContent = "Procesando pago atomico...";
    setStatus("Procesando pago + minteo atomico en ER...", "info");

    try {
        const tokenId = Date.now();
        const tokenUri = paymentData.metadata_uri;

        const businessWallet = new solanaWeb3.PublicKey(paymentData.business_wallet);
        const amountLamports = paymentData.amount_lamports;

        // Construir PDAs
        const poapPda = solanaWeb3.PublicKey.findProgramAddressSync(
            [
            Buffer.from(POAP_SEED),
            walletPublicKey.toBuffer(),
            new BN(tokenId).toArrayLike(Buffer, "le", 8),
            ],
            new solanaWeb3.PublicKey(PROGRAM_ID)
        );

        const configPda = solanaWeb3.PublicKey.findProgramAddressSync(
            [Buffer.from(CONFIG_SEED)],
            new solanaWeb3.PublicKey(PROGRAM_ID)
        );

        // Construir instruccion de mint_business (pago + minteo atomico)
        const ix = await buildMintBusinessInstruction(
            tokenId,
            tokenUri,
            paymentData.latitude,
            paymentData.longitude,
            amountLamports,
            poapPda[0],
            configPda[0],
            businessWallet
        );

        const tx = new solanaWeb3.Transaction();
        tx.add(ix);
        tx.feePayer = walletPublicKey;

        const { blockhash } = await magicRouterConnection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        // Firmar y enviar al Magic Router
        const signedTx = await window.solana.signTransaction(tx);
        const txHash = await magicRouterConnection.sendRawTransaction(
            signedTx.serialize(),
            { skipPreflight: true }
        );

        setStatus(`Pago + Insignia minteados atomicamente! Tx: ${txHash.slice(0, 20)}...`, "success");

        showBusinessResult({
            business_name: paymentData.business_name,
            amount_sol: amountLamports / 1e9,
            token_id: tokenId,
            poap_pda: poapPda[0].toString(),
            business_wallet: businessWallet.toString(),
            tx_hash: txHash,
        });

        payBtn.textContent = "Completado!";
        payBtn.style.background = "var(--primary)";
        payBtn.style.color = "white";
    } catch (e) {
        console.error("Error pago:", e);
        setStatus("Error en transaccion atomica: " + e.message, "error");
        payBtn.disabled = false;
        payBtn.textContent = "Reintentar Pago";
    }
}

function showBusinessResult(data) {
    const card = document.getElementById("business-result-card");
    const result = document.getElementById("business-result");
    card.classList.remove("hidden");

    result.innerHTML = `
        <div class="result-box">
            <p><strong>Negocio:</strong> ${data.business_name}</p>
            <p><strong>Monto pagado:</strong> ${data.amount_sol} SOL</p>
            <p><strong>Token ID (Insignia):</strong> <code>${data.token_id}</code></p>
            <p><strong>POAP PDA:</strong> <code>${data.poap_pda}</code></p>
            <p><strong>Wallet Negocio:</strong> <code>${data.business_wallet}</code></p>
            <p><strong>Tx Hash:</strong> <code>${data.tx_hash}</code></p>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Instruction Builders (simulacion — en produccion se usa el IDL de Anchor)
// ---------------------------------------------------------------------------

// En un escenario real, estas instrucciones se construyen con el IDL de Anchor:
//   const program = new anchor.Program(idl, programId, provider);
//   const ix = await program.methods.mintPlace(...).accounts({...}).instruction();
//
// Para el prototipo, construimos las instrucciones manualmente con los
// discriminadores correctos de Anchor. Los discriminadores se generan como
// los primeros 8 bytes del sha256("global:<method_name>").

async function buildMintPlaceInstruction(
    tokenId, tokenUri, lat, lon, poapType, poapPda, configPda
) {
    // Discriminador: sha256("global:mint_place")[0..8]
    const discriminator = await getAnchorDiscriminator("global:mint_place");

    const args = encodeMintPlaceArgs(tokenId, tokenUri, lat, lon, poapType);

    const keys = [
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: poapPda, isSigner: false, isWritable: true },
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const data = Buffer.concat([discriminator, args]);
    return new solanaWeb3.TransactionInstruction({
        programId: new solanaWeb3.PublicKey(PROGRAM_ID),
        keys,
        data,
    });
}

async function buildMintBusinessInstruction(
    tokenId, tokenUri, lat, lon, amountLamports, poapPda, configPda, businessWallet
) {
    const discriminator = await getAnchorDiscriminator("global:mint_business");

    const args = encodeMintBusinessArgs(tokenId, tokenUri, lat, lon, amountLamports);

    const keys = [
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: businessWallet, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: poapPda, isSigner: false, isWritable: true },
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const data = Buffer.concat([discriminator, args]);
    return new solanaWeb3.TransactionInstruction({
        programId: new solanaWeb3.PublicKey(PROGRAM_ID),
        keys,
        data,
    });
}

async function buildDelegateInstruction(tokenId, poapPda) {
    const discriminator = await getAnchorDiscriminator("global:delegate");

    const tokenIdBn = new BN(tokenId);
    const args = tokenIdBn.toArrayLike(Buffer, "le", 8);

    const keys = [
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: poapPda, isSigner: false, isWritable: true },
        // Cadas adicionales (buffer, delegation_record, etc.) son inyectadas
        // por el macro #[delegate] — se requieren como remaining_accounts
    ];

    const data = Buffer.concat([discriminator, args]);
    return new solanaWeb3.TransactionInstruction({
        programId: new solanaWeb3.PublicKey(PROGRAM_ID),
        keys,
        data,
    });
}

// --- Codificacion de argumentos (Borsh) ---

function encodeMintPlaceArgs(tokenId, tokenUri, lat, lon, poapType) {
    // u64 token_id, string token_uri, f64 lat, f64 lon, u8 poap_type
    const tokenIdBuf = new BN(tokenId).toArrayLike(Buffer, "le", 8);
    const uriBuf = Buffer.from(tokenUri, "utf8");
    const uriLenBuf = Buffer.alloc(4);
    uriLenBuf.writeUInt32LE(uriBuf.length, 0);
    const latBuf = Buffer.alloc(8);
    latBuf.writeDoubleLE(lat, 0);
    const lonBuf = Buffer.alloc(8);
    lonBuf.writeDoubleLE(lon, 0);
    const typeBuf = Buffer.alloc(1);
    typeBuf.writeUInt8(poapType, 0);

    return Buffer.concat([tokenIdBuf, uriLenBuf, uriBuf, latBuf, lonBuf, typeBuf]);
}

function encodeMintBusinessArgs(tokenId, tokenUri, lat, lon, amountLamports) {
    // u64 token_id, string token_uri, f64 lat, f64 lon, u64 amount_lamports
    const tokenIdBuf = new BN(tokenId).toArrayLike(Buffer, "le", 8);
    const uriBuf = Buffer.from(tokenUri, "utf8");
    const uriLenBuf = Buffer.alloc(4);
    uriLenBuf.writeUInt32LE(uriBuf.length, 0);
    const latBuf = Buffer.alloc(8);
    latBuf.writeDoubleLE(lat, 0);
    const lonBuf = Buffer.alloc(8);
    lonBuf.writeDoubleLE(lon, 0);
    const amountBuf = new BN(amountLamports).toArrayLike(Buffer, "le", 8);

    return Buffer.concat([tokenIdBuf, uriLenBuf, uriBuf, latBuf, lonBuf, amountBuf]);
}

// --- Discriminador de Anchor ---

async function getAnchorDiscriminator(methodName) {
    const encoder = new TextEncoder();
    const data = encoder.encode(methodName);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hash.slice(0, 8));
}

// ---------------------------------------------------------------------------
// Status Bar
// ---------------------------------------------------------------------------

function setStatus(msg, type = "info") {
    const bar = document.getElementById("status-text");
    bar.textContent = msg;
    bar.className = type;
    console.log(`[Huellazo ${type}] ${msg}`);
}

// ---------------------------------------------------------------------------
// BN polyfill (simple version for encoding)
// ---------------------------------------------------------------------------

class BN {
    constructor(value) {
        this.value = BigInt(value);
    }

    toArrayLike(Buffer, endian, length) {
        const result = Buffer.alloc(length);
        let val = this.value;
        for (let i = 0; i < length; i++) {
            result[i] = Number(val & 0xffn);
            val >>= 8n;
        }
        return result;
    }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

window.addEventListener("DOMContentLoaded", init);