// Configuration
const contractAddress = "0x95e256A1ca9dA61A559940C75693a4C78E41dEfe"; // Vui lòng điền địa chỉ Smart Contract thực tế vào đây

const contractABI = [
    "constructor()",
    "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
    "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
    "event MarketItemCreated(uint256 indexed tokenId, address seller, address owner, uint256 price, bool sold)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    "function approve(address to, uint256 tokenId)",
    "function balanceOf(address owner) view returns (uint256)",
    "function cancelListing(uint256 tokenId)",
    "function createMarketItem(uint256 tokenId, uint256 price)",
    "function createMarketSale(uint256 tokenId) payable",
    "function createToken(string tokenURI, uint256 price) payable returns (uint256)",
    "function fetchItemsListed() view returns (tuple(uint256 tokenId, address seller, address owner, uint256 price, bool sold)[])",
    "function fetchMarketItems() view returns (tuple(uint256 tokenId, address seller, address owner, uint256 price, bool sold)[])",
    "function fetchMyNFTs() view returns (tuple(uint256 tokenId, address seller, address owner, uint256 price, bool sold)[])",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function getListingPrice() view returns (uint256)",
    "function getMarketItem(uint256 tokenId) view returns (tuple(uint256 tokenId, address seller, address owner, uint256 price, bool sold))",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function name() view returns (string)",
    "function owner() view returns (address)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function renounceOwnership()",
    "function resellToken(uint256 tokenId, uint256 price) payable",
    "function safeTransferFrom(address from, address to, uint256 tokenId)",
    "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
    "function setApprovalForAll(address operator, bool approved)",
    "function supportsInterface(bytes4 interfaceId) view returns (bool)",
    "function symbol() view returns (string)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function transferFrom(address from, address to, uint256 tokenId)",
    "function updateItemPrice(uint256 tokenId, uint256 newPrice)",
    "function transferOwnership(address newOwner)",
    "function updateListingPrice(uint256 _listingPrice)"
];

// App State
const state = {
    provider: null,
    signer: null,
    contract: null,
    userAddress: null,
    currentView: 'home',
    uploadedImageURL: null
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();

    // Check if MetaMask is already connected
    if (window.ethereum) {
        try {
            // Tự động kết nối Web3 provider cho phép đọc dữ liệu (Read-only) ngay cả khi user chưa login ví
            state.provider = new ethers.providers.Web3Provider(window.ethereum);
            try {
                state.contract = new ethers.Contract(contractAddress, contractABI, state.provider);
                setupBlockchainListeners();
            } catch (e) {
                console.warn("Invalid contract address configuration.");
            }

            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            } else {
                loadMarketplaceData();
            }

            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                    state.userAddress = accounts[0];
                    updateUIForConnectedWallet();
                    if (state.currentView === 'profile') loadProfileData();
                    if (state.currentView === 'home') loadMarketplaceData();
                } else {
                    disconnectWallet();
                }
            });
        } catch (error) {
            console.error("Error checking wallet connection:", error);
        }
    } else {
        showToast("MetaMask is not installed. Please install it to use this DApp.", "error");
    }
});

// Navigation
function navigate(viewId) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.getElementById(`nav-${viewId}`).classList.add('active');

    document.querySelectorAll('.view').forEach(view => view.classList.remove('active-view'));
    document.getElementById(`view-${viewId}`).classList.add('active-view');

    state.currentView = viewId;

    if (viewId === 'home') {
        loadMarketplaceData();
    } else if (viewId === 'profile') {
        if (!state.userAddress) {
            showToast("Vui lòng kết nối ví để xem Profile", "warning");
        } else {
            loadProfileData();
        }
    }
}

// Wallet Connection
async function connectWallet() {
    if (!window.ethereum) {
        showToast("Please install MetaMask to use this feature!", "error");
        return;
    }

    try {
        state.provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Network Check
        const network = await state.provider.getNetwork();
        const SEPOLIA_CHAIN_ID = 11155111;
        if (network.chainId !== SEPOLIA_CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }], // 11155111 in hex
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    showToast("Vui lòng thêm mạng Sepolia vào MetaMask.", "error");
                } else {
                    showToast("Từ chối chuyển sang mạng Sepolia.", "error");
                }
                return;
            }
            state.provider = new ethers.providers.Web3Provider(window.ethereum);
        }

        await state.provider.send("eth_requestAccounts", []);
        state.signer = state.provider.getSigner();
        state.userAddress = await state.signer.getAddress();

        try {
            state.contract = new ethers.Contract(contractAddress, contractABI, state.signer);
            setupBlockchainListeners();
        } catch (e) {
            console.error("Invalid contract address.", e);
            showToast("Sai địa chỉ Contract. Vui lòng cập nhật contractAddress trong app.js", "error");
            return;
        }

        updateUIForConnectedWallet();
        showToast("Đã kết nối ví thành công!", "success");

        if (state.currentView === 'home') loadMarketplaceData();
    } catch (error) {
        console.error(error);
        showToast("Lỗi kết nối ví.", "error");
    }
}

function disconnectWallet() {
    state.userAddress = null;
    state.signer = null;
    state.contract = null;

    // Tự động gán lại read-only contract để vẫn xem được chợ
    if (state.provider) {
        state.contract = new ethers.Contract(contractAddress, contractABI, state.provider);
    }

    const btn = document.getElementById('connect-wallet-btn');
    btn.innerHTML = `<i class="ph ph-wallet"></i><span>Connect Wallet</span>`;
    document.getElementById('profile-wallet-address').innerText = "Not Connected";

    showToast("Wallet disconnected.", "info");
}

function updateUIForConnectedWallet() {
    if (!state.userAddress) return;

    const shortAddress = `${state.userAddress.substring(0, 6)}...${state.userAddress.substring(state.userAddress.length - 4)}`;

    const btn = document.getElementById('connect-wallet-btn');
    btn.innerHTML = `<i class="ph ph-check-circle"></i><span>${shortAddress}</span>`;

    document.getElementById('profile-wallet-address').innerText = state.userAddress;
}

// Core Functions
async function loadMarketplaceData() {
    const grid = document.getElementById('marketplace-grid');
    const loader = document.getElementById('loading-marketplace');

    grid.innerHTML = '';
    loader.style.display = 'flex';

    try {
        if (!state.contract) throw new Error("Contract not connected");

        const data = await state.contract.fetchMarketItems();
        const items = await Promise.all(data.map(async i => {
            const tokenUri = await state.contract.tokenURI(i.tokenId);
            const meta = await fetchMetaData(tokenUri);
            let price = ethers.utils.formatUnits(i.price.toString(), 'ether');

            return {
                tokenId: i.tokenId.toNumber(),
                price,
                priceRaw: i.price.toString(),
                seller: i.seller,
                owner: i.owner,
                image: meta.image,
                name: meta.name,
                desc: meta.description,
                category: meta.category || 'Digital Art'
            };
        }));

        loader.style.display = 'none';

        if (items.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1"><i class="ph ph-storefront"></i><p>Hiện tại chưa có NFT nào được bày bán.</p></div>`;
            return;
        }

        grid.innerHTML = items.map(nft => createNFTCard(nft, 'buy')).join('');
        app.applyFilters();

    } catch (error) {
        console.error("Error loading marketplace:", error);
        loader.style.display = 'none';
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1"><i class="ph ph-warning-circle"></i><p>Lỗi kết nối mạng lưới. Vui lòng đảm bảo Smart Contract đã được deploy và nhập đúng địa chỉ vào app.js</p></div>`;
    }
}

async function loadProfileData() {
    loadCollectedNFTs();
    loadListedNFTs();
}

async function loadCollectedNFTs() {
    const grid = document.getElementById('collected-grid');
    const loader = document.getElementById('loading-collected');
    const emptyState = document.getElementById('empty-collected');

    grid.innerHTML = '';
    loader.style.display = 'flex';
    emptyState.style.display = 'none';

    try {
        if (!state.contract) throw new Error("Contract not connected");
        const data = await state.contract.fetchMyNFTs();
        const items = await Promise.all(data.map(async i => {
            const tokenUri = await state.contract.tokenURI(i.tokenId);
            const meta = await fetchMetaData(tokenUri);
            let price = ethers.utils.formatUnits(i.price.toString(), 'ether');

            return {
                tokenId: i.tokenId.toNumber(),
                price,
                priceRaw: i.price.toString(),
                seller: i.seller,
                owner: i.owner,
                image: meta.image,
                name: meta.name,
                desc: meta.description,
                category: meta.category || 'Digital Art'
            };
        }));

        loader.style.display = 'none';

        if (items.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        grid.innerHTML = items.map(nft => createNFTCard(nft, 'owned')).join('');

    } catch (error) {
        console.error(error);
        loader.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

async function loadListedNFTs() {
    const grid = document.getElementById('listed-grid');
    const loader = document.getElementById('loading-listed');
    const emptyState = document.getElementById('empty-listed');

    grid.innerHTML = '';
    loader.style.display = 'flex';
    emptyState.style.display = 'none';

    try {
        if (!state.contract) throw new Error("Contract not connected");
        const data = await state.contract.fetchItemsListed();
        const items = await Promise.all(data.map(async i => {
            const tokenUri = await state.contract.tokenURI(i.tokenId);
            const meta = await fetchMetaData(tokenUri);
            let price = ethers.utils.formatUnits(i.price.toString(), 'ether');

            return {
                tokenId: i.tokenId.toNumber(),
                price,
                priceRaw: i.price.toString(),
                seller: i.seller,
                owner: i.owner,
                image: meta.image,
                name: meta.name,
                desc: meta.description,
                category: meta.category || 'Digital Art'
            };
        }));

        loader.style.display = 'none';

        if (items.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        grid.innerHTML = items.map(nft => createNFTCard(nft, 'listed')).join('');

    } catch (error) {
        console.error(error);
        loader.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

// Minting Logic
async function mintNFT() {
    if (!state.userAddress) {
        showToast("Vui lòng kết nối ví trước", "error");
        return;
    }

    const name = document.getElementById('nft-name').value;
    const desc = document.getElementById('nft-desc').value;
    const priceInput = document.getElementById('nft-price').value;
    const category = document.getElementById('nft-category').value;

    if (!name || !desc || !priceInput) {
        showToast("Vui lòng điền đầy đủ tên, mô tả và giá", "warning");
        return;
    }

    const btn = document.getElementById('mint-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<div class="spinner" style="width:20px;height:20px;margin:0;border-width:2px;"></div> Đang xác nhận...`;
    btn.disabled = true;

    try {
        const metadata = JSON.stringify({
            name,
            description: desc,
            category: category,
            image: state.uploadedImageURL || `https://via.placeholder.com/400?text=${encodeURIComponent(name)}`
        });

        const tokenURI = `data:application/json;base64,${btoa(unescape(encodeURIComponent(metadata)))}`;

        if (!state.contract) throw new Error("Contract not connected");
        const price = ethers.utils.parseUnits(priceInput, 'ether');
        const listingPrice = await state.contract.getListingPrice();

        showTxOverlay("Waiting for Approval", "Vui lòng xác nhận giao dịch trên MetaMask...");
        const transaction = await state.contract.createToken(tokenURI, price, { value: listingPrice });
        showTxOverlay("Processing Transaction", "Đang chờ block xác nhận. Quá trình này có thể mất 10-15 giây.");
        const receipt = await transaction.wait();
        hideTxOverlay();
        showToast(`Tạo và Đăng bán NFT Thành công! <a href="https://sepolia.etherscan.io/tx/${receipt.transactionHash}" target="_blank" style="color:#10b981; text-decoration:underline;">View on Etherscan</a>`, "success");

        // Get Token ID from event
        const transferEvent = receipt.events.find(e => e.event === 'Transfer' && e.args.from === ethers.constants.AddressZero);
        const tokenId = transferEvent ? transferEvent.args.tokenId.toString() : 'Unknown';

        // Display Result Box
        document.getElementById('mint-res-id').innerText = `#${tokenId}`;
        document.getElementById('mint-res-creator').innerText = state.userAddress.substring(0, 8) + '...';
        document.getElementById('mint-res-tx').href = `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`;
        
        // Cần mã hóa nhỏ gọn để url base64 không bị quá dài nếu nhấp vào
        document.getElementById('mint-res-uri').href = tokenURI.length > 50 ? '#' : tokenURI;
        document.getElementById('mint-res-uri').onclick = () => {
            if (tokenURI.length > 50) {
                const newWindow = window.open();
                newWindow.document.write(`<pre>${JSON.stringify(JSON.parse(metadata), null, 2)}</pre>`);
            }
        };

        document.getElementById('mint-result').style.display = 'block';

        // Reset form
        document.getElementById('nft-name').value = '';
        document.getElementById('nft-desc').value = '';
        document.getElementById('nft-price').value = '';
        document.getElementById('image-preview').style.display = 'none';
        document.getElementById('upload-area').style.display = 'block';
        state.uploadedImageURL = null;

        // Tự động reload Marketplace ngầm
        loadMarketplaceData();

    } catch (error) {
        hideTxOverlay();
        console.error("Error minting:", error);
        if (error.code === 4001) {
            showToast("Giao dịch bị huỷ bởi người dùng.", "error");
        } else {
            showToast(error.message || "Tạo NFT Thất bại", "error");
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Overlay Logic
function showTxOverlay(title, desc) {
    const titleEl = document.getElementById('tx-title');
    const descEl = document.getElementById('tx-desc');
    const overlayEl = document.getElementById('tx-overlay');
    if (titleEl) titleEl.innerText = title;
    if (descEl) descEl.innerText = desc;
    if (overlayEl) overlayEl.classList.add('active');
}

function hideTxOverlay() {
    const overlayEl = document.getElementById('tx-overlay');
    if (overlayEl) overlayEl.classList.remove('active');
}

async function executeCancelListing(tokenId) {
    if (!state.userAddress) return;
    try {
        if (!state.contract) throw new Error("Contract not connected");
        showTxOverlay("Waiting for Approval", "Vui lòng xác nhận huỷ bán trên MetaMask...");
        const transaction = await state.contract.cancelListing(tokenId);
        
        showTxOverlay("Processing Transaction", "Đang chờ block xác nhận...");
        const receipt = await transaction.wait();
        hideTxOverlay();

        showToast(`Huỷ bán thành công! <a href="https://sepolia.etherscan.io/tx/${receipt.transactionHash}" target="_blank" style="color:#10b981; text-decoration:underline;">View on Etherscan</a>`, "success");
        loadProfileData();
    } catch(error) {
        hideTxOverlay();
        console.error(error);
        if (error.code === 4001) {
            showToast("Giao dịch bị huỷ bởi người dùng.", "error");
        } else {
            showToast("Huỷ bán thất bại.", "error");
        }
    }
}

function openEditPriceModal(tokenId, currentPrice) {
    document.getElementById('edit-price-token-id').value = tokenId;
    document.getElementById('edit-price-input').value = currentPrice;
    document.getElementById('edit-price-modal').classList.add('active');
}

async function executeEditPrice() {
    const tokenId = document.getElementById('edit-price-token-id').value;
    const priceInput = document.getElementById('edit-price-input').value;

    if (!priceInput) {
        showToast("Vui lòng nhập giá mới", "warning");
        return;
    }

    try {
        if (!state.contract) throw new Error("Contract not connected");
        const priceFormatted = ethers.utils.parseUnits(priceInput, 'ether');
        
        showTxOverlay("Waiting for Approval", "Vui lòng xác nhận đổi giá trên MetaMask...");
        const transaction = await state.contract.updateItemPrice(tokenId, priceFormatted);
        showTxOverlay("Processing Transaction", "Đang chờ block xác nhận...");
        const receipt = await transaction.wait();
        hideTxOverlay();

        showToast(`Cập nhật giá thành công! <a href="https://sepolia.etherscan.io/tx/${receipt.transactionHash}" target="_blank" style="color:#10b981; text-decoration:underline;">View on Etherscan</a>`, "success");
        closeModal('edit-price-modal');
        loadProfileData();

    } catch (error) {
        hideTxOverlay();
        console.error(error);
        if (error.code === 4001) {
            showToast("Giao dịch bị huỷ bởi người dùng.", "error");
        } else {
            showToast("Cập nhật giá thất bại", "error");
        }
    }
}

// Marketplace Actions
async function buyNFT(tokenId, price) {
    if (!state.userAddress) {
        showToast("Vui lòng kết nối ví để mua", "error");
        return;
    }

    try {
        if (!state.contract) throw new Error("Contract not connected");
        const priceFormatted = ethers.utils.parseUnits(price.toString(), 'ether');
        showTxOverlay("Waiting for Approval", "Vui lòng xác nhận giao dịch trên MetaMask...");
        const transaction = await state.contract.createMarketSale(tokenId, { value: priceFormatted });

        showTxOverlay("Processing Transaction", "Đang chờ block xác nhận. Quá trình này có thể mất 10-15 giây.");
        const receipt = await transaction.wait();
        hideTxOverlay();

        showToast(`Mua NFT thành công! <a href="https://sepolia.etherscan.io/tx/${receipt.transactionHash}" target="_blank" style="color:#10b981; text-decoration:underline;">View on Etherscan</a>`, "success");
        loadMarketplaceData();

    } catch (error) {
        hideTxOverlay();
        console.error(error);
        if (error.code === 4001) {
            showToast("Giao dịch bị huỷ bởi người dùng.", "error");
        } else {
            showToast("Giao dịch mua thất bại. Có thể bạn không đủ ETH.", "error");
        }
    }
}

function openResellModal(tokenId) {
    document.getElementById('resell-token-id').value = tokenId;
    document.getElementById('resell-modal').classList.add('active');
}

async function executeResell() {
    const tokenId = document.getElementById('resell-token-id').value;
    const priceInput = document.getElementById('resell-price').value;

    if (!priceInput) {
        showToast("Vui lòng nhập giá", "warning");
        return;
    }

    try {
        if (!state.contract) throw new Error("Contract not connected");
        const priceFormatted = ethers.utils.parseUnits(priceInput, 'ether');
        const listingPrice = await state.contract.getListingPrice();

        showTxOverlay("Waiting for Approval", "Vui lòng xác nhận đăng bán trên MetaMask...");
        const transaction = await state.contract.resellToken(tokenId, priceFormatted, { value: listingPrice });
        showTxOverlay("Processing Transaction", "Đang chờ block xác nhận...");
        const receipt = await transaction.wait();
        hideTxOverlay();

        showToast(`Đăng bán lại thành công! <a href="https://sepolia.etherscan.io/tx/${receipt.transactionHash}" target="_blank" style="color:#10b981; text-decoration:underline;">View on Etherscan</a>`, "success");
        closeModal('resell-modal');
        loadProfileData();

    } catch (error) {
        hideTxOverlay();
        console.error(error);
        if (error.code === 4001) {
            showToast("Giao dịch bị huỷ bởi người dùng.", "error");
        } else {
            showToast("Đăng bán lại thất bại", "error");
        }
    }
}

function openTransferModal(tokenId) {
    document.getElementById('transfer-token-id').value = tokenId;
    document.getElementById('transfer-modal').classList.add('active');
}

async function executeTransfer() {
    const tokenId = document.getElementById('transfer-token-id').value;
    const address = document.getElementById('transfer-address').value;

    if (!address || !ethers.utils.isAddress(address)) {
        showToast("Địa chỉ ví không hợp lệ", "warning");
        return;
    }

    try {
        if (!state.contract) throw new Error("Contract not connected");
        showTxOverlay("Waiting for Approval", "Vui lòng xác nhận chuyển trên MetaMask...");
        const transaction = await state.contract.transferFrom(state.userAddress, address, tokenId);
        showTxOverlay("Processing Transaction", "Đang chờ block xác nhận...");
        const receipt = await transaction.wait();
        hideTxOverlay();

        showToast(`Chuyển NFT thành công! <a href="https://sepolia.etherscan.io/tx/${receipt.transactionHash}" target="_blank" style="color:#10b981; text-decoration:underline;">View on Etherscan</a>`, "success");
        closeModal('transfer-modal');
        loadProfileData();

    } catch (error) {
        hideTxOverlay();
        console.error(error);
        if (error.code === 4001) {
            showToast("Giao dịch bị huỷ bởi người dùng.", "error");
        } else {
            showToast("Chuyển thất bại", "error");
        }
    }
}

// Utility Functions
function createNFTCard(nft, mode) {
    let actionButton = '';

    if (mode === 'buy') {
        actionButton = `<button class="btn btn-primary btn-block nft-action" onclick="app.buyNFT(${nft.tokenId}, '${nft.price}')">Buy for ${nft.price} ETH</button>`;
    } else if (mode === 'owned') {
        actionButton = `
            <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                <button class="btn btn-primary" style="flex:1;" onclick="app.openResellModal(${nft.tokenId})">Sell</button>
                <button class="btn btn-secondary" style="flex:1;" onclick="app.openTransferModal(${nft.tokenId})">Transfer</button>
            </div>`;
    } else if (mode === 'listed') {
        actionButton = `
            <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                <button class="btn btn-secondary" style="flex:1;" onclick="app.openEditPriceModal(${nft.tokenId}, '${nft.price}')">Edit (${nft.price})</button>
                <button class="btn btn-primary" style="flex:1; background: #ef4444;" onclick="app.executeCancelListing(${nft.tokenId})">Cancel</button>
            </div>`;
    }

    const shortSeller = nft.seller ? `${nft.seller.substring(0, 6)}...${nft.seller.substring(nft.seller.length - 4)}` : 'Unknown';

    let statusBadge = mode === 'buy' ? `<div style="position: absolute; top: 1rem; right: 1rem; background: rgba(16, 185, 129, 0.9); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">For Sale</div>` : '';

    // Prepare safely encoded NFT data to pass to modal
    const nftJson = encodeURIComponent(JSON.stringify({
        tokenId: nft.tokenId,
        name: nft.name,
        desc: nft.description || nft.desc,
        image: nft.image,
        price: nft.price,
        category: nft.category || 'Digital Art',
        seller: nft.seller,
        owner: nft.owner,
        mode: mode,
        priceRaw: nft.priceRaw
    }));

    return `
        <div class="nft-card" data-category="${nft.category || 'Digital Art'}" data-price="${nft.priceRaw || 0}">
            <div class="nft-image-wrapper" onclick="app.openNFTDetailModal('${nftJson}')" style="cursor: pointer;">
                <img src="${nft.image}" alt="${nft.name}" class="nft-image">
                ${statusBadge}
            </div>
            <div class="nft-details">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="nft-name" style="margin: 0;">${nft.name}</h3>
                    <span style="font-family: monospace; color: var(--text-secondary); background: rgba(255,255,255,0.1); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.8rem;">#${nft.tokenId}</span>
                </div>
                <div class="nft-creator">
                    <div class="creator-avatar"></div>
                    <span>${shortSeller}</span>
                </div>
                <div class="nft-meta">
                    <div>
                        <span class="nft-price-label">Price</span>
                        <div class="nft-price-value">
                            <i class="ph ph-currency-eth"></i>
                            ${nft.price} ETH
                        </div>
                    </div>
                </div>
                ${actionButton}
            </div>
        </div>
    `;
}

function applyFilters() {
    const searchVal = document.getElementById('search-filter') ? document.getElementById('search-filter').value.toLowerCase() : '';
    const categoryVal = document.getElementById('category-filter') ? document.getElementById('category-filter').value : 'all';
    const sortVal = document.getElementById('sort-filter') ? document.getElementById('sort-filter').value : 'recent';
    
    const grid = document.getElementById('marketplace-grid');
    if (!grid) return;
    
    let cards = Array.from(grid.getElementsByClassName('nft-card'));
    
    cards.forEach(card => {
        const name = card.querySelector('h3').innerText.toLowerCase();
        const category = card.getAttribute('data-category');
        
        let matchSearch = name.includes(searchVal);
        let matchCategory = categoryVal === 'all' || category === categoryVal;
        
        card.style.display = matchSearch && matchCategory ? 'flex' : 'none';
    });

    // Sorting
    const visibleCards = cards.filter(card => card.style.display !== 'none');
    
    if (sortVal === 'price-low') {
        visibleCards.sort((a, b) => parseFloat(a.getAttribute('data-price')) - parseFloat(b.getAttribute('data-price')));
    } else if (sortVal === 'price-high') {
        visibleCards.sort((a, b) => parseFloat(b.getAttribute('data-price')) - parseFloat(a.getAttribute('data-price')));
    } else {
        visibleCards.sort((a, b) => {
            const idA = parseInt(a.querySelector('span[style*="monospace"]').innerText.replace('#', ''));
            const idB = parseInt(b.querySelector('span[style*="monospace"]').innerText.replace('#', ''));
            return idB - idA; // Descending Token ID = recent
        });
    }

    visibleCards.forEach(card => grid.appendChild(card));
}

function openNFTDetailModal(encodedNft) {
    const nft = JSON.parse(decodeURIComponent(encodedNft));
    
    document.getElementById('detail-image').src = nft.image;
    document.getElementById('detail-name').innerText = nft.name;
    document.getElementById('detail-id').innerText = `#${nft.tokenId}`;
    document.getElementById('detail-category').innerText = nft.category;
    document.getElementById('detail-desc').innerText = nft.desc || 'No description provided.';
    document.getElementById('detail-seller').innerText = nft.seller;
    document.getElementById('detail-owner').innerText = nft.owner;
    document.getElementById('detail-price').innerText = nft.price;

    const actionContainer = document.getElementById('detail-action-container');
    let actionButton = '';

    if (nft.mode === 'buy') {
        actionButton = `<button class="btn btn-primary btn-block btn-lg" onclick="app.buyNFT(${nft.tokenId}, '${nft.price}')">Buy Now</button>`;
    } else if (nft.mode === 'owned') {
        actionButton = `
            <div style="display:flex; gap:1rem;">
                <button class="btn btn-primary btn-lg" style="flex:1;" onclick="app.closeModal('nft-detail-modal'); app.openResellModal(${nft.tokenId})">Sell</button>
                <button class="btn btn-secondary btn-lg" style="flex:1;" onclick="app.closeModal('nft-detail-modal'); app.openTransferModal(${nft.tokenId})">Transfer</button>
            </div>`;
    } else if (nft.mode === 'listed') {
        actionButton = `
            <div style="display:flex; gap:1rem;">
                <button class="btn btn-secondary btn-lg" style="flex:1;" onclick="app.closeModal('nft-detail-modal'); app.openEditPriceModal(${nft.tokenId}, '${nft.price}')">Edit Price</button>
                <button class="btn btn-primary btn-lg" style="flex:1; background: #ef4444;" onclick="app.closeModal('nft-detail-modal'); app.executeCancelListing(${nft.tokenId})">Cancel Listing</button>
            </div>`;
    }
    
    actionContainer.innerHTML = actionButton;
    document.getElementById('nft-detail-modal').classList.add('active');
}

function setupEventListeners() {
    const fileInput = document.getElementById('nft-image');
    const uploadArea = document.getElementById('upload-area');
    const imagePreview = document.getElementById('image-preview');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 300;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    // Nén ảnh xuống chất lượng 50% định dạng JPEG để siêu nhẹ
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
                    
                    state.uploadedImageURL = compressedDataUrl;
                    imagePreview.src = compressedDataUrl;
                    imagePreview.style.display = 'block';
                    uploadArea.style.display = 'none';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Bắt sự kiện Realtime từ Blockchain
function setupBlockchainListeners() {
    if (!state.contract) return;
    
    // Xóa listener cũ để tránh lặp khi gọi lại
    state.contract.removeAllListeners("MarketItemCreated");
    state.contract.removeAllListeners("Transfer");

    // Lắng nghe sự kiện ai đó Đăng bán hoặc Mua
    state.contract.on("MarketItemCreated", () => {
        console.log("Realtime Update: MarketItemCreated event detected!");
        if (state.currentView === 'home') loadMarketplaceData();
        if (state.currentView === 'profile') loadProfileData();
    });

    // Lắng nghe sự kiện chuyển nhượng NFT (Mua thành công hoặc Chuyển ví)
    state.contract.on("Transfer", () => {
        console.log("Realtime Update: Transfer event detected!");
        if (state.currentView === 'home') loadMarketplaceData();
        if (state.currentView === 'profile') loadProfileData();
    });
}

async function verifyNFT() {
    const tokenId = document.getElementById('verify-token-id').value;
    if (!tokenId) {
        showToast("Vui lòng nhập Token ID", "warning");
        return;
    }

    const resultDiv = document.getElementById('verify-result');
    const loader = document.getElementById('loading-verify');
    
    resultDiv.style.display = 'none';
    loader.style.display = 'block';

    try {
        if (!state.contract) throw new Error("Contract not connected");
        
        let tokenUri;
        try {
            tokenUri = await state.contract.tokenURI(tokenId);
        } catch (e) {
            throw new Error("NFT không tồn tại hoặc Token ID sai.");
        }

        const marketItem = await state.contract.getMarketItem(tokenId);
        const meta = await fetchMetaData(tokenUri);
        
        const filter = state.contract.filters.Transfer(ethers.constants.AddressZero, null, Number(tokenId));
        const events = await state.contract.queryFilter(filter);
        const creator = events.length > 0 ? events[0].args.to : "Unknown";

        const actualOwner = await state.contract.ownerOf(tokenId);

        let status = "Minted / Not for sale";
        if (marketItem.owner === state.contract.address) {
            const priceEth = ethers.utils.formatUnits(marketItem.price, 'ether');
            status = `For Sale (${priceEth} ETH)`;
        } else if (marketItem.sold) {
            status = "Sold / Collected";
        }

        document.getElementById('verify-image').src = meta.image;
        document.getElementById('verify-name').innerText = meta.name;
        document.getElementById('verify-desc').innerText = meta.description;
        document.getElementById('verify-id').innerText = `#${tokenId}`;
        document.getElementById('verify-creator').innerText = creator;
        document.getElementById('verify-owner').innerText = actualOwner === state.contract.address ? marketItem.seller : actualOwner;
        document.getElementById('verify-status').innerText = status;
        
        const uriLink = document.getElementById('verify-uri');
        uriLink.innerText = tokenUri.length > 40 ? tokenUri.substring(0, 40) + '...' : tokenUri;
        uriLink.href = tokenUri;

        loader.style.display = 'none';
        resultDiv.style.display = 'block';

    } catch (error) {
        loader.style.display = 'none';
        console.error(error);
        showToast(error.message || "Lỗi khi tra cứu NFT", "error");
    }
}

function switchProfileTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`content-${tabId}`).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function fetchMetaData(tokenURI) {
    if (tokenURI.startsWith('data:application/json;base64,')) {
        const base64 = tokenURI.split(',')[1];
        const jsonString = atob(base64);
        return JSON.parse(jsonString);
    }
    try {
        const response = await fetch(tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/'));
        return await response.json();
    } catch (e) {
        return { name: "Unknown", description: "", image: "https://via.placeholder.com/400" };
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'warning-circle';
    if (type === 'warning') icon = 'warning';

    toast.innerHTML = `<i class="ph ph-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse backwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

window.app = {
    navigate,
    connectWallet,
    mintNFT,
    buyNFT,
    executeCancelListing,
    openEditPriceModal,
    executeEditPrice,
    openResellModal,
    executeResell,
    openTransferModal,
    executeTransfer,
    switchProfileTab,
    closeModal,
    verifyNFT,
    applyFilters,
    openNFTDetailModal
};
