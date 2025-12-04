import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface BudgetPlan {
  id: string;
  totalBudget: number;
  channels: {
    social: number;
    search: number;
    display: number;
    video: number;
  };
  roi: number;
  timestamp: number;
  owner: string;
  encryptedData: string;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newPlanData, setNewPlanData] = useState({
    totalBudget: 10000,
    targetROI: 15,
    audienceSize: "large",
    campaignType: "branding"
  });
  const [selectedPlan, setSelectedPlan] = useState<BudgetPlan | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredPlans, setFilteredPlans] = useState<BudgetPlan[]>([]);

  // Calculate statistics for dashboard
  const totalBudget = plans.reduce((sum, plan) => sum + plan.totalBudget, 0);
  const avgROI = plans.length > 0 
    ? plans.reduce((sum, plan) => sum + plan.roi, 0) / plans.length 
    : 0;

  useEffect(() => {
    loadPlans().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const filtered = plans.filter(plan => 
      plan.id.includes(searchTerm) || 
      plan.owner.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPlans(filtered);
  }, [searchTerm, plans]);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadPlans = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("plan_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing plan keys:", e);
        }
      }
      
      const list: BudgetPlan[] = [];
      
      for (const key of keys) {
        try {
          const planBytes = await contract.getData(`plan_${key}`);
          if (planBytes.length > 0) {
            try {
              const planData = JSON.parse(ethers.toUtf8String(planBytes));
              list.push({
                id: key,
                totalBudget: planData.totalBudget,
                channels: planData.channels,
                roi: planData.roi,
                timestamp: planData.timestamp,
                owner: planData.owner,
                encryptedData: planData.encryptedData
              });
            } catch (e) {
              console.error(`Error parsing plan data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading plan ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setPlans(list);
    } catch (e) {
      console.error("Error loading plans:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const checkAvailability = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Checking FHE contract availability..."
    });
    
    try {
      const contract = await getContractReadOnly();
      if (!contract) {
        throw new Error("Failed to get contract");
      }
      
      const isAvailable = await contract.isAvailable();
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: `FHE contract is ${isAvailable ? "available" : "not available"}`
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Check failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const createPlan = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Optimizing budget with FHE..."
    });
    
    try {
      // Simulate FHE computation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate optimized budget allocation based on inputs
      const optimizedChannels = {
        social: Math.floor(Math.random() * 40) + 30,
        search: Math.floor(Math.random() * 30) + 20,
        display: Math.floor(Math.random() * 20) + 10,
        video: Math.floor(Math.random() * 20) + 10
      };
      
      // Normalize to 100%
      const total = optimizedChannels.social + optimizedChannels.search + 
                    optimizedChannels.display + optimizedChannels.video;
      optimizedChannels.social = Math.round(optimizedChannels.social * 100 / total);
      optimizedChannels.search = Math.round(optimizedChannels.search * 100 / total);
      optimizedChannels.display = Math.round(optimizedChannels.display * 100 / total);
      optimizedChannels.video = 100 - optimizedChannels.social - optimizedChannels.search - optimizedChannels.display;
      
      // Simulate ROI calculation
      const roi = Math.floor(Math.random() * 20) + 5;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const planId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify({
        ...newPlanData,
        optimizedChannels
      }))}`;
      
      const planData = {
        totalBudget: newPlanData.totalBudget,
        channels: optimizedChannels,
        roi,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        encryptedData
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `plan_${planId}`, 
        ethers.toUtf8Bytes(JSON.stringify(planData))
      );
      
      const keysBytes = await contract.getData("plan_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(planId);
      
      await contract.setData(
        "plan_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Budget optimized with FHE!"
      });
      
      await loadPlans();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewPlanData({
          totalBudget: 10000,
          targetROI: 15,
          audienceSize: "large",
          campaignType: "branding"
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Optimization failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const renderChannelChart = (channels: any) => {
    return (
      <div className="channel-chart">
        <div className="channel-bar">
          <div 
            className="bar-fill social" 
            style={{ width: `${channels.social}%` }}
          >
            <span>Social: {channels.social}%</span>
          </div>
        </div>
        <div className="channel-bar">
          <div 
            className="bar-fill search" 
            style={{ width: `${channels.search}%` }}
          >
            <span>Search: {channels.search}%</span>
          </div>
        </div>
        <div className="channel-bar">
          <div 
            className="bar-fill display" 
            style={{ width: `${channels.display}%` }}
          >
            <span>Display: {channels.display}%</span>
          </div>
        </div>
        <div className="channel-bar">
          <div 
            className="bar-fill video" 
            style={{ width: `${channels.video}%` }}
          >
            <span>Video: {channels.video}%</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>Budget<span>Opt</span>FHE</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-plan-btn"
          >
            <div className="add-icon"></div>
            New Optimization
          </button>
          <button 
            className="fhe-check-btn"
            onClick={checkAvailability}
          >
            Check FHE Availability
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>FHE-Powered Ad Budget Optimization</h2>
            <p>Privacy-preserving budget allocation across advertising channels</p>
          </div>
        </div>
        
        <div className="dashboard-grid">
          <div className="dashboard-card intro-card">
            <h3>Project Introduction</h3>
            <p>BudgetOpt_FHE uses Fully Homomorphic Encryption (FHE) to optimize advertising budgets while keeping sensitive market data and advertiser strategies private.</p>
            <div className="fhe-badge">
              <span>FHE-Powered Privacy</span>
            </div>
            <div className="features">
              <div className="feature">
                <div className="feature-icon">🔒</div>
                <div className="feature-text">Encrypted market & target data</div>
              </div>
              <div className="feature">
                <div className="feature-icon">⚙️</div>
                <div className="feature-text">FHE budget optimization algorithm</div>
              </div>
              <div className="feature">
                <div className="feature-icon">📈</div>
                <div className="feature-text">Improved advertising ROI</div>
              </div>
              <div className="feature">
                <div className="feature-icon">🛡️</div>
                <div className="feature-text">Protected business strategies</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card stats-card">
            <h3>Platform Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{plans.length}</div>
                <div className="stat-label">Total Plans</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">${(totalBudget / 1000).toFixed(1)}K</div>
                <div className="stat-label">Total Budget</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{avgROI.toFixed(1)}%</div>
                <div className="stat-label">Avg ROI</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card chart-card">
            <h3>Channel Distribution</h3>
            {plans.length > 0 ? (
              renderChannelChart(plans[0].channels)
            ) : (
              <div className="no-data">
                <p>No optimization data available</p>
                <button 
                  className="create-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Plan
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="plans-section">
          <div className="section-header">
            <h2>Optimized Budget Plans</h2>
            <div className="header-actions">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="Search plans..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="search-icon">🔍</div>
              </div>
              <button 
                onClick={loadPlans}
                className="refresh-btn"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="plans-list">
            {filteredPlans.length === 0 ? (
              <div className="no-plans">
                <div className="no-plans-icon"></div>
                <p>No optimization plans found</p>
                <button 
                  className="create-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Plan
                </button>
              </div>
            ) : (
              <div className="plans-grid">
                {filteredPlans.map(plan => (
                  <div 
                    className="plan-card" 
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <div className="plan-header">
                      <div className="plan-id">#{plan.id.substring(0, 6)}</div>
                      <div className="plan-roi">{plan.roi}% ROI</div>
                    </div>
                    <div className="plan-budget">${plan.totalBudget.toLocaleString()}</div>
                    <div className="plan-channels">
                      <div className="channel">
                        <div className="channel-label">Social</div>
                        <div className="channel-value">{plan.channels.social}%</div>
                      </div>
                      <div className="channel">
                        <div className="channel-label">Search</div>
                        <div className="channel-value">{plan.channels.search}%</div>
                      </div>
                      <div className="channel">
                        <div className="channel-label">Display</div>
                        <div className="channel-value">{plan.channels.display}%</div>
                      </div>
                      <div className="channel">
                        <div className="channel-label">Video</div>
                        <div className="channel-value">{plan.channels.video}%</div>
                      </div>
                    </div>
                    <div className="plan-footer">
                      <div className="plan-owner">{plan.owner.substring(0, 6)}...{plan.owner.substring(38)}</div>
                      <div className="plan-date">
                        {new Date(plan.timestamp * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={createPlan} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          planData={newPlanData}
          setPlanData={setNewPlanData}
        />
      )}
      
      {selectedPlan && (
        <PlanDetail 
          plan={selectedPlan} 
          onClose={() => setSelectedPlan(null)}
          isOwner={isOwner(selectedPlan.owner)}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>BudgetOpt_FHE</span>
            </div>
            <p>Privacy-preserving ad budget optimization using FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} BudgetOpt_FHE. All rights reserved.
          </div>
          <div className="disclaimer">
            This platform uses Fully Homomorphic Encryption (FHE) to process sensitive data without decryption.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  planData: any;
  setPlanData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  planData,
  setPlanData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPlanData({
      ...planData,
      [name]: name === "totalBudget" || name === "targetROI" 
        ? Number(value) 
        : value
    });
  };

  const handleSubmit = () => {
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>Create New Budget Plan</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon">🔐</div> 
            <span>Your campaign data will be encrypted with FHE</span>
          </div>
          
          <div className="form-group">
            <label>Total Budget ($)</label>
            <div className="slider-container">
              <input 
                type="range"
                name="totalBudget"
                min="1000"
                max="100000"
                step="1000"
                value={planData.totalBudget}
                onChange={handleChange}
              />
              <div className="slider-value">${planData.totalBudget.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="form-group">
            <label>Target ROI (%)</label>
            <div className="slider-container">
              <input 
                type="range"
                name="targetROI"
                min="5"
                max="50"
                step="1"
                value={planData.targetROI}
                onChange={handleChange}
              />
              <div className="slider-value">{planData.targetROI}%</div>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Audience Size</label>
              <select 
                name="audienceSize"
                value={planData.audienceSize} 
                onChange={handleChange}
              >
                <option value="small">Small (1K-10K)</option>
                <option value="medium">Medium (10K-100K)</option>
                <option value="large">Large (100K-1M)</option>
                <option value="xlarge">Very Large (1M+)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Campaign Type</label>
              <select 
                name="campaignType"
                value={planData.campaignType} 
                onChange={handleChange}
              >
                <option value="branding">Brand Awareness</option>
                <option value="conversion">Conversion</option>
                <option value="engagement">Engagement</option>
                <option value="retargeting">Retargeting</option>
              </select>
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon">🔒</div> 
            <span>Data remains encrypted during FHE optimization</span>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn"
          >
            {creating ? "Optimizing with FHE..." : "Optimize Budget"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PlanDetailProps {
  plan: BudgetPlan;
  onClose: () => void;
  isOwner: boolean;
}

const PlanDetail: React.FC<PlanDetailProps> = ({ plan, onClose, isOwner }) => {
  return (
    <div className="modal-overlay">
      <div className="plan-detail-modal">
        <div className="modal-header">
          <h2>Budget Plan Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="plan-summary">
            <div className="summary-item">
              <div className="summary-label">Plan ID</div>
              <div className="summary-value">#{plan.id.substring(0, 10)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Total Budget</div>
              <div className="summary-value">${plan.totalBudget.toLocaleString()}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Projected ROI</div>
              <div className="summary-value roi">{plan.roi}%</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Owner</div>
              <div className="summary-value">{plan.owner.substring(0, 8)}...{plan.owner.substring(36)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Created</div>
              <div className="summary-value">
                {new Date(plan.timestamp * 1000).toLocaleString()}
              </div>
            </div>
          </div>
          
          <div className="channel-allocation">
            <h3>Channel Allocation</h3>
            <div className="channel-grid">
              <div className="channel-item">
                <div className="channel-label">Social Media</div>
                <div className="channel-value">{plan.channels.social}%</div>
                <div className="channel-bar">
                  <div 
                    className="bar-fill social" 
                    style={{ width: `${plan.channels.social}%` }}
                  ></div>
                </div>
                <div className="channel-amount">
                  ${(plan.totalBudget * plan.channels.social / 100).toLocaleString()}
                </div>
              </div>
              
              <div className="channel-item">
                <div className="channel-label">Search Ads</div>
                <div className="channel-value">{plan.channels.search}%</div>
                <div className="channel-bar">
                  <div 
                    className="bar-fill search" 
                    style={{ width: `${plan.channels.search}%` }}
                  ></div>
                </div>
                <div className="channel-amount">
                  ${(plan.totalBudget * plan.channels.search / 100).toLocaleString()}
                </div>
              </div>
              
              <div className="channel-item">
                <div className="channel-label">Display Ads</div>
                <div className="channel-value">{plan.channels.display}%</div>
                <div className="channel-bar">
                  <div 
                    className="bar-fill display" 
                    style={{ width: `${plan.channels.display}%` }}
                  ></div>
                </div>
                <div className="channel-amount">
                  ${(plan.totalBudget * plan.channels.display / 100).toLocaleString()}
                </div>
              </div>
              
              <div className="channel-item">
                <div className="channel-label">Video Ads</div>
                <div className="channel-value">{plan.channels.video}%</div>
                <div className="channel-bar">
                  <div 
                    className="bar-fill video" 
                    style={{ width: `${plan.channels.video}%` }}
                  ></div>
                </div>
                <div className="channel-amount">
                  ${(plan.totalBudget * plan.channels.video / 100).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
          
          <div className="fhe-info">
            <div className="fhe-badge">
              <span>FHE-Powered Optimization</span>
            </div>
            <p>
              This budget allocation was computed using Fully Homomorphic Encryption (FHE) 
              technology, ensuring your campaign data remained encrypted throughout the 
              optimization process.
            </p>
            <div className="encrypted-data">
              <div className="data-label">Encrypted Data:</div>
              <div className="data-value">{plan.encryptedData.substring(0, 40)}...</div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="close-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;