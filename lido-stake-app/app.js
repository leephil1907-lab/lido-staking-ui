import { createAppKit } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@latest/dist/esm/index.js';
import { EthersAdapter } from 'https://cdn.jsdelivr.net/npm/@reown/appkit-adapter-ethers@latest/dist/esm/index.js';
import { mainnet } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@latest/dist/esm/networks.js';

const PROJECT_ID = '7ee282b2996b54334564e0f64beebed1';
const PLATFORM_URL = 'https://lidostake.org';

const LIDO_CONTRACTS = {
    lido: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    withdrawalQueue: '0x889edC2eDab8f4B4f2d89abf85dE641d39e3d58D',
};

const LIDO_ABI = [
    "function submit(address _referral) external payable returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function getSharesByPooledEth(uint256 _ethAmount) external view returns (uint256)",
    "function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const appKit = createAppKit({
    adapters: [new EthersAdapter()],
    projectId: PROJECT_ID,
    networks: [mainnet],
    metadata: {
        name: 'Lido Stake',
        description: 'Liquid ETH Staking Platform',
        url: PLATFORM_URL,
        icons: [`${PLATFORM_URL}/icon.png`]
    },
    themeMode: 'dark'
});

let provider = null;
let signer = null;
let userAddress = null;
let lidoContract = null;
let ethBalance = 0;
let stethBalance = 0;

const connectBtn = document.getElementById('connectBtn');
const stakeBtn = document.getElementById('stakeBtn');
const unstakeBtn = document.getElementById('unstakeBtn');
const stakeAmount = document.getElementById('stakeAmount');

async function init() {
    try {
        const walletProvider = appKit.getWalletProvider();
        if (walletProvider) await handleConnect();
    } catch (e) {}
    
    appKit.subscribeProviders(async (providers) => {
        if (providers.eip155) await handleConnect();
        else handleDisconnect();
    });
    
    stakeAmount.addEventListener('input', updateAnnualReward);
}

async function handleConnect() {
    try {
        const walletProvider = appKit.getWalletProvider();
        if (!walletProvider) return;
        
        const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
        
        provider = new ethers.BrowserProvider(walletProvider);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();
        
        lidoContract = new ethers.Contract(LIDO_CONTRACTS.lido, LIDO_ABI, signer);
        
        updateWalletUI();
        await updateBalances();
        showNotification('Wallet connected!', 'success');
    } catch (error) {
        showNotification('Connection failed', 'error');
    }
}

function handleDisconnect() {
    provider = signer = userAddress = lidoContract = null;
    connectBtn.textContent = 'Connect Wallet';
    connectBtn.classList.remove('connected');
    stakeBtn.textContent = 'Connect Wallet to Stake';
    stakeBtn.disabled = false;
    unstakeBtn.textContent = 'Connect Wallet to Unstake';
    unstakeBtn.disabled = true;
    document.getElementById('ethBalance').textContent = '0.00';
    document.getElementById('userSteth').textContent = '0.00';
}

function updateWalletUI() {
    connectBtn.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    connectBtn.classList.add('connected');
    stakeBtn.textContent = 'Stake ETH';
    stakeBtn.disabled = false;
    unstakeBtn.textContent = 'Request Withdrawal';
    unstakeBtn.disabled = false;
}

async function updateBalances() {
    if (!provider || !userAddress || !lidoContract) return;
    try {
        const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
        
        const balance = await provider.getBalance(userAddress);
        ethBalance = parseFloat(ethers.formatEther(balance));
        document.getElementById('ethBalance').textContent = ethBalance.toFixed(4);
        document.getElementById('unstakeAvailable').textContent = ethBalance.toFixed(4);
        
        const stethBal = await lidoContract.balanceOf(userAddress);
        stethBalance = parseFloat(ethers.formatEther(stethBal));
        document.getElementById('userSteth').textContent = stethBalance.toFixed(4);
        document.getElementById('stethBalanceDisplay').textContent = stethBalance.toFixed(4) + ' stETH';
        
        const rewards = stethBalance > 0 ? (stethBalance * 0.038) : 0;
        document.getElementById('rewardsEarned').textContent = '+' + rewards.toFixed(4) + ' ETH';
        
        const usdValue = stethBalance * 3000;
        document.getElementById('currentValue').textContent = '$' + usdValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    } catch (error) {
        console.error('Balance error:', error);
    }
}

window.stakeETH = async function() {
    if (!signer || !lidoContract) {
        await appKit.open();
        return;
    }
    
    const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
    const amount = parseFloat(stakeAmount.value);
    
    if (!amount || amount <= 0) {
        showNotification('Enter valid amount', 'error');
        return;
    }
    if (amount > ethBalance) {
        showNotification('Insufficient ETH', 'error');
        return;
    }
    
    try {
        stakeBtn.disabled = true;
        stakeBtn.textContent = 'Processing...';
        
        const value = ethers.parseEther(amount.toString());
        const tx = await lidoContract.submit(ethers.ZeroAddress, { value });
        await tx.wait();
        
        showNotification(`Staked ${amount} ETH!`, 'success');
        stakeAmount.value = '';
        updateAnnualReward();
        await updateBalances();
    } catch (error) {
        showNotification('Transaction failed', 'error');
    } finally {
        stakeBtn.disabled = false;
        stakeBtn.textContent = 'Stake ETH';
    }
};

window.unstakeETH = async function() {
    if (!signer) {
        await appKit.open();
        return;
    }
    
    const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
    const amount = parseFloat(document.getElementById('unstakeAmount').value);
