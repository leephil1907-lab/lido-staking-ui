import { createAppKit } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@latest/dist/esm/index.js';
import { EthersAdapter } from 'https://cdn.jsdelivr.net/npm/@reown/appkit-adapter-ethers@latest/dist/esm/index.js';
import { mainnet, arbitrum, optimism } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@latest/dist/esm/networks.js';

const PROJECT_ID = '7ee282b2996b54334564e0f64beebed1';
const PLATFORM_URL = 'https://lidostake.org';

// Multiple Token Support - Lido on different chains
const SUPPORTED_TOKENS = {
    ethereum: {
        chainId: 1,
        name: 'Ethereum',
        lido: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        wstETH: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
        withdrawalQueue: '0x889edC2eDab8f4B4f2d89abf85dE641d39e3d58D',
        symbol: 'ETH',
        tokenSymbol: 'stETH',
        apy: 3.8
    },
    arbitrum: {
        chainId: 42161,
        name: 'Arbitrum',
        lido: '0x5979D7b546E38E414F7E9822514be443A4800529',
        stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        symbol: 'ETH',
        tokenSymbol: 'wstETH',
        apy: 3.6
    },
    optimism: {
        chainId: 10,
        name: 'Optimism',
        lido: '0x1F32b1C2345538c0c6f582fCB022739c4A194E86',
        stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        symbol: 'ETH',
        tokenSymbol: 'wstETH',
        apy: 3.7
    }
};

const LIDO_ABI = [
    "function submit(address _referral) external payable returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function getSharesByPooledEth(uint256 _ethAmount) external view returns (uint256)",
    "function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256)",
    "function getTotalPooledEther() external view returns (uint256)",
    "function getTotalShares() external view returns (uint256)",
    "function wrap(uint256 _amount) external returns (uint256)",
    "function unwrap(uint256 _amount) external returns (uint256)",
    "event Submitted(address indexed sender, uint256 amount, address referral)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Wrapped(address indexed sender, uint256 amount)",
    "event Unwrapped(address indexed sender, uint256 amount)"
];

// Transaction History Storage
const TX_HISTORY_KEY = 'lido_tx_history';

const appKit = createAppKit({
    adapters: [new EthersAdapter()],
    projectId: PROJECT_ID,
    networks: [mainnet, arbitrum, optimism],
    metadata: {
        name: 'Lido Stake',
        description: 'Multi-Chain Liquid ETH Staking',
        url: PLATFORM_URL,
        icons: [`${PLATFORM_URL}/icon.png`]
    },
    themeMode: 'dark'
});

let provider = null;
let signer = null;
let userAddress = null;
let currentChain = 'ethereum';
let lidoContract = null;

// Transaction History Management
class TransactionHistory {
    static getAll() {
        const history = localStorage.getItem(TX_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    }

    static add(tx) {
        const history = this.getAll();
        const newTx = {
            id: Date.now().toString(),
            hash: tx.hash,
            type: tx.type,
            amount: tx.amount,
            chain: currentChain,
            status: tx.status || 'pending',
            timestamp: Date.now(),
            from: userAddress,
            to: tx.to || SUPPORTED_TOKENS[currentChain].lido
        };
        history.unshift(newTx);
        localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(history.slice(0, 100))); // Keep last 100
        return newTx;
    }

    static update(hash, updates) {
        const history = this.getAll();
        const index = history.findIndex(tx => tx.hash === hash);
        if (index !== -1) {
            history[index] = { ...history[index], ...updates };
            localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(history));
        }
    }

    static clear() {
        localStorage.removeItem(TX_HISTORY_KEY);
    }

    static getByChain(chain) {
        return this.getAll().filter(tx => tx.chain === chain);
    }

    static getStats() {
        const history = this.getAll();
        return {
            totalStaked: history.filter(tx => tx.type === 'stake' && tx.status === 'success').reduce((a, b) => a + parseFloat(b.amount), 0),
            totalUnstaked: history.filter(tx => tx.type === 'unstake' && tx.status === 'success').reduce((a, b) => a + parseFloat(b.amount), 0),
            totalTransactions: history.length,
            successfulTxs: history.filter(tx => tx.status === 'success').length
        };
    }
}

// Initialize
async function init() {
    renderChainSelector();
    renderTransactionHistory();
    
    try {
        const walletProvider = appKit.getWalletProvider();
        if (walletProvider) await handleConnect();
    } catch (e) {}
    
    appKit.subscribeProviders(async (providers) => {
        if (providers.eip155) await handleConnect();
        else handleDisconnect();
    });
    
    document.getElementById('stakeAmount').addEventListener('input', updateAnnualReward);
}

async function handleConnect() {
    try {
        const walletProvider = appKit.getWalletProvider();
        if (!walletProvider) return;
        
        const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
        
        provider = new ethers.BrowserProvider(walletProvider);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();
        
        // Get current network
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        
        // Determine which chain we're on
        currentChain = Object.keys(SUPPORTED_TOKENS).find(
            key => SUPPORTED_TOKENS[key].chainId === chainId
        ) || 'ethereum';
        
        updateChainSelector();
        
        // Initialize contract for current chain
        const token = SUPPORTED_TOKENS[currentChain];
        lidoContract = new ethers.Contract(token.lido, LIDO_ABI, signer);
        
        updateWalletUI();
        await updateBalances();
        await updateTransactionHistory();
        
        showNotification(`Connected to ${token.name}`, 'success');
    } catch (error) {
        showNotification('Connection failed: ' + (error?.message || error), 'error');
    }
}

function handleDisconnect() {
    provider = signer = userAddress = lidoContract = null;
    updateWalletUI();
}

// ==================== SIGNATURE VERIFICATION ====================

/**
 * Sign a message to prove wallet ownership
 */
window.signMessage = async function() {
    if (!signer) {
        showNotification('Connect wallet first', 'error');
        return;
    }
    
    try {
        const message = `Verify ownership of ${userAddress} at ${Date.now()}`;
        const signature = await signer.signMessage(message);
        
        // Verify signature
        const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
        const recoveredAddress = ethers.verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() === userAddress.toLowerCase()) {
            showNotification('Signature verified successfully!', 'success');
            addSignatureToHistory({
                type: 'signature',
                message: message,
                signature: signature,
                recoveredAddress: recoveredAddress,
                timestamp: Date.now()
            });
            return signature;
        } else {
            throw new Error('Signature verification failed');
        }
    } catch (error) {
        showNotification('Signing failed: ' + (error?.message || error), 'error');
    }
};

/**
 * Sign typed data (EIP-712) for permits
 */
window.signTypedData = async function() {
    if (!signer) {
        showNotification('Connect wallet first', 'error');
        return;
    }
    
    const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
    const domain = {
        name: 'Lido Stake',
        version: '1',
        chainId: SUPPORTED_TOKENS[currentChain].chainId,
        verifyingContract: SUPPORTED_TOKENS[currentChain].lido
    };
    
    const types = {
        Stake: [
            { name: 'amount', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
            { name: 'user', type: 'address' }
        ]
    };
    
    const value = {
        amount: ethers.parseEther('1'),
        timestamp: Date.now(),
        user: userAddress
    };
    
    try {
        const signature = await signer.signTypedData(domain, types, value);
        showNotification('Typed data signed!', 'success');
        return signature;
    } catch (error) {
        showNotification('Typed signing failed: ' + (error?.message || error), 'error');
    }
};

// ==================== MULTI-CHAIN STAKING ====================

window.switchChain = async function(chainKey) {
    if (!provider) {
        showNotification('Connect wallet first', 'error');
        return;
    }
    
    try {
        await appKit.switchNetwork(SUPPORTED_TOKENS[chainKey].chainId);
        currentChain = chainKey;
        await handleConnect();
        showNotification(`Switched to ${SUPPORTED_TOKENS[chainKey].name}`, 'success');
    } catch (error) {
        showNotification('Chain switch failed: ' + (error?.message || error), 'error');
    }
};

window.stakeETH = async function() {
    if (!signer || !lidoContract) {
        await appKit.open();
        return;
    }
    
    const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
    const amount = parseFloat(document.getElementById('stakeAmount').value);
    
    if (!amount || amount <= 0) {
        showNotification('Enter valid amount', 'error');
        return;
    }
    
    const balance = await provider.getBalance(userAddress);
    if (ethers.parseEther(amount.toString()) > balance) {
        showNotification('Insufficient ETH', 'error');
        return;
    }
    
    try {
        const btn = document.getElementById('stakeBtn');
        btn.disabled = true;
        btn.textContent = 'Confirming...';
        
        const value = ethers.parseEther(amount.toString());
        const tx = await lidoContract.submit(ethers.ZeroAddress, { value });
        
        // Add to history immediately
        TransactionHistory.add({
            hash: tx.hash,
            type: 'stake',
            amount: amount,
            status: 'pending'
        });
        
        btn.textContent = 'Processing...';
        await tx.wait();
        
        // Update history
        TransactionHistory.update(tx.hash, { status: 'success' });
        
        showNotification(`Staked ${amount} ETH on ${SUPPORTED_TOKENS[currentChain].name}!`, 'success');
        document.getElementById('stakeAmount').value = '';
        updateAnnualReward();
        await updateBalances();
        await updateTransactionHistory();
        
    } catch (error) {
        showNotification('Stake failed: ' + (error?.message || error), 'error');
    } finally {
        const btn = document.getElementById('stakeBtn');
        btn.disabled = false;
        btn.textContent = 'Stake ETH';
    }
};

window.unstakeETH = async function() {
    if (!signer) {
        await appKit.open();
        return;
    }
    
    const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
    const amount = parseFloat(document.getElementById('unstakeAmount').value);
    
    if (!amount || amount <= 0) {
        showNotification('Enter valid amount', 'error');
        return;
    }
    
    const token = SUPPORTED_TOKENS[currentChain];
    
    try {
        const btn = document.getElementById('unstakeBtn');
        btn.disabled = true;
        btn.textContent = 'Processing...';
        
        let tx;
        
        if (currentChain === 'ethereum') {
            // Mainnet - use withdrawal queue
            const withdrawalQueue = new ethers.Contract(
                token.withdrawalQueue,
                ["function requestWithdrawals(uint256[] calldata _amounts, address _owner) external returns (uint256[] memory requestIds)"],
                signer
            );
            
            const ethAmount = ethers.parseEther(amount.toString());
            const shares = await lidoContract.getSharesByPooledEth(ethAmount);
            tx = await withdrawalQueue.requestWithdrawals([shares], userAddress);
        } else {
            // L2 - unwrap wstETH to stETH
            tx = await lidoContract.unwrap(ethers.parseEther(amount.toString()));
        }
        
        TransactionHistory.add({
            hash: tx.hash,
            type: 'unstake',
            amount: amount,
            status: 'pending'
        });
        
        await tx.wait();
        TransactionHistory.update(tx.hash, { status: 'success' });
        
        showNotification('Unstake successful!', 'success');
        document.getElementById('unstakeAmount').value = '';
        await updateBalances();
        await updateTransactionHistory();
        
    } catch (error) {
        showNotification('Unstake failed: ' + (error?.message || error), 'error');
    } finally {
        const btn = document.getElementById('unstakeBtn');
        btn.disabled = false;
        btn.textContent = 'Request Withdrawal';
    }
};

// ==================== UI UPDATES ====================

async function updateBalances() {
    if (!provider || !userAddress || !lidoContract) return;
    
    try {
        const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
        const token = SUPPORTED_TOKENS[currentChain];
        
        const ethBal = await provider.getBalance(userAddress);
        document.getElementById('ethBalance').textContent = parseFloat(ethers.formatEther(ethBal)).toFixed(4);
        
        const stethBal = await lidoContract.balanceOf(userAddress);
        const formatted = parseFloat(ethers.formatEther(stethBal));
        document.getElementById('userSteth').textContent = formatted.toFixed(4);
        document.getElementById('stethBalanceDisplay').textContent = `${formatted.toFixed(4)} ${token.tokenSymbol}`;
        document.getElementById('unstakeAvailable').textContent = formatted.toFixed(4);
        
        const rewards = formatted > 0 ? (formatted * token.apy / 100) : 0;
        document.getElementById('rewardsEarned').textContent = `+${rewards.toFixed(4)} ${token.symbol}`;
        
        const usdValue = formatted * 3000;
        document.getElementById('currentValue').textContent = '$' + usdValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
    } catch (error) {
        console.error('Balance error:', error);
    }
}

function updateAnnualReward() {
    const amount = parseFloat(document.getElementById('stakeAmount').value) || 0;
    const apy = SUPPORTED_TOKENS[currentChain]?.apy || 3.8;
    const reward = amount * apy / 100;
    document.getElementById('annualReward').textContent = `+${reward.toFixed(4)} ETH`;
}

function renderChainSelector() {
    const selector = document.getElementById('chainSelector');
    if (!selector) return;
    
    selector.innerHTML = Object.entries(SUPPORTED_TOKENS).map(([key, token]) => `
        <button class="chain-btn ${key === currentChain ? 'active' : ''}" onclick="switchChain('${key}')">
            ${token.name}
        </button>
    `).join('');
}

function updateChainSelector() {
    renderChainSelector();
}

async function updateTransactionHistory() {
    const container = document.getElementById('txHistory');
    if (!container) return;
    
    const history = TransactionHistory.getByChain(currentChain);
    const stats = TransactionHistory.getStats();
    
    if (history.length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions yet</p>';
        return;
    }
    
    container.innerHTML = history.map(tx => `
        <div class="tx-item ${tx.status}">
            <div class="tx-icon">${tx.type === 'stake' ? '⚡' : '💧'}</div>
            <div class="tx-details">
                <div class="tx-type">${tx.type === 'stake' ? 'Staked' : 'Unstaked'} ${tx.amount} ${SUPPORTED_TOKENS[currentChain].symbol}</div>
                <div class="tx-meta">${new Date(tx.timestamp).toLocaleString()}</div>
            </div>
            <div class="tx-status ${tx.status}">${tx.status}</div>
            <a href="https://${currentChain === 'ethereum' ? '' : currentChain + '.'}etherscan.io/tx/${tx.hash}" target="_blank" class="tx-link">View</a>
        </div>
    `).join('');
    
    // Update stats
    document.getElementById('totalStaked').textContent = stats.totalStaked.toFixed(4) + ' ETH';
    document.getElementById('totalTxs').textContent = stats.totalTransactions;
}

function renderTransactionHistory() {
    // HTML will be rendered by updateTransactionHistory
}

function addSignatureToHistory(sigData) {
    const history = JSON.parse(localStorage.getItem('lido_signatures') || '[]');
    history.unshift(sigData);
    localStorage.setItem('lido_signatures', JSON.stringify(history.slice(0, 50)));
}

// ==================== UTILITIES ====================

window.setMaxStake = function() {
    const balance = parseFloat(document.getElementById('ethBalance').textContent);
    if (balance > 0.01) {
        document.getElementById('stakeAmount').value = (balance - 0.01).toFixed(4);
        updateAnnualReward();
    }
};

window.setMaxUnstake = function() {
    const balance = parseFloat(document.getElementById('unstakeAvailable').textContent);
    if (balance > 0) {
        document.getElementById('unstakeAmount').value = balance.toFixed(4);
    }
};

window.clearHistory = function() {
    if (confirm('Clear all transaction history?')) {
        TransactionHistory.clear();
        updateTransactionHistory();
        showNotification('History cleared', 'success');
    }
};

window.exportHistory = function() {
    const history = TransactionHistory.getAll();
    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lido-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

function updateWalletUI() {
    const btn = document.getElementById('connectBtn');
    if (userAddress) {
        btn.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        btn.classList.add('connected');
        document.getElementById('stakeBtn').textContent = 'Stake ETH';
        document.getElementById('stakeBtn').disabled = false;
        document.getElementById('unstakeBtn').textContent = 'Request Withdrawal';
        document.getElementById('unstakeBtn').disabled = false;
    } else {
        btn.textContent = 'Connect Wallet';
        btn.classList.remove('connected');
        document.getElementById('stakeBtn').textContent = 'Connect Wallet to Stake';
        document.getElementById('unstakeBtn').textContent = 'Connect Wallet to Unstake';
        document.getElementById('unstakeBtn').disabled = true;
    }
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    const icon = document.getElementById('notificationIcon');
    const text = document.getElementById('notificationText');
    
    notification.className = 'notification ' + type;
    icon.textContent = type === 'success' ? '✓' : '✕';
    text.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// Event listeners
document.getElementById('connectBtn')?.addEventListener('click', async () => {
    if (!userAddress) await appKit.open();
});

// Initialize
init();
