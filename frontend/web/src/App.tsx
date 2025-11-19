import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface IdentityCard {
  id: string;
  name: string;
  age: number;
  encryptedAge: string;
  description: string;
  timestamp: number;
  creator: string;
  isVerified: boolean;
  decryptedAge?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<IdentityCard[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newCardData, setNewCardData] = useState({ name: "", age: "", description: "" });
  const [selectedCard, setSelectedCard] = useState<IdentityCard | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "verified" | "unverified">("all");
  const [showFAQ, setShowFAQ] = useState(false);
  const [showPartners, setShowPartners] = useState(false);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized) return;
      
      try {
        console.log('Initializing FHEVM for identity system...');
        await initialize();
        console.log('FHEVM initialized successfully');
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize]);

  useEffect(() => {
    const loadData = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadCards();
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isConnected]);

  const loadCards = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const cardsList: IdentityCard[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          cardsList.push({
            id: businessId,
            name: businessData.name,
            age: Number(businessData.publicValue1) || 0,
            encryptedAge: businessId,
            description: businessData.description,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            isVerified: businessData.isVerified,
            decryptedAge: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading identity data:', e);
        }
      }
      
      setCards(cardsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load identity cards" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createIdentityCard = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingCard(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating FHE identity card..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const ageValue = parseInt(newCardData.age) || 0;
      const businessId = `identity-${Date.now()}`;
      
      const encryptedResult = await encrypt(await contract.getAddress(), address, ageValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newCardData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        ageValue,
        0,
        newCardData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Encrypting age data..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Identity card created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadCards();
      setShowCreateModal(false);
      setNewCardData({ name: "", age: "", description: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingCard(false); 
    }
  };

  const decryptAge = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Age already verified on-chain" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        await contractWrite.getAddress(),
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying age decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadCards();
      
      setTransactionStatus({ visible: true, status: "success", message: "Age verified successfully!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Age is already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadCards();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Age verification failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const available = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "FHE system is available and ready" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "System check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         card.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "all" || 
                         (activeFilter === "verified" && card.isVerified) ||
                         (activeFilter === "unverified" && !card.isVerified);
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: cards.length,
    verified: cards.filter(c => c.isVerified).length,
    averageAge: cards.length > 0 ? Math.round(cards.reduce((sum, c) => sum + c.age, 0) / cards.length) : 0
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🔐 FHE Identity Cards</h1>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🆔</div>
            <h2>Connect to Access FHE Identity System</h2>
            <p>Your privacy-preserving digital identity awaits. Connect your wallet to begin.</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect wallet to initialize FHE encryption</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Create your private identity card</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Verify age without revealing your birthday</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Identity System...</p>
        <p>Status: {status}</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading identity cards...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>🔐 FHE Identity Cards</h1>
          <span>Privacy-Preserving Digital Identity</span>
        </div>
        
        <div className="header-actions">
          <button onClick={checkAvailability} className="system-check-btn">
            System Check
          </button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + New Identity
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>

      <nav className="app-nav">
        <button onClick={() => { setShowFAQ(false); setShowPartners(false); }} className="nav-btn active">
          Identity Cards
        </button>
        <button onClick={() => setShowFAQ(true)} className="nav-btn">
          FAQ
        </button>
        <button onClick={() => setShowPartners(true)} className="nav-btn">
          Partners
        </button>
      </nav>
      
      <main className="main-content">
        {showFAQ ? (
          <div className="faq-section">
            <h2>FHE Identity System FAQ</h2>
            <div className="faq-list">
              <div className="faq-item">
                <h3>How does FHE protect my age information?</h3>
                <p>Your age is encrypted using Fully Homomorphic Encryption, allowing verification without revealing the actual number.</p>
              </div>
              <div className="faq-item">
                <h3>Is my data stored on-chain?</h3>
                <p>Only encrypted data is stored on-chain. The decryption key remains with you.</p>
              </div>
              <div className="faq-item">
                <h3>What can I use this identity for?</h3>
                <p>Age-restricted services, anonymous verification, and privacy-compliant authentication.</p>
              </div>
            </div>
          </div>
        ) : showPartners ? (
          <div className="partners-section">
            <h2>Technology Partners</h2>
            <div className="partners-grid">
              <div className="partner-card">
                <div className="partner-icon">🔐</div>
                <h3>Zama</h3>
                <p>FHE Technology Provider</p>
              </div>
              <div className="partner-card">
                <div className="partner-icon">⚡</div>
                <h3>FHEVM</h3>
                <p>Encrypted Smart Contracts</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="dashboard-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Identities</h3>
                  <div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat-card">
                  <h3>Verified Cards</h3>
                  <div className="stat-value">{stats.verified}</div>
                </div>
                <div className="stat-card">
                  <h3>Avg Age</h3>
                  <div className="stat-value">{stats.averageAge}</div>
                </div>
              </div>
            </div>

            <div className="controls-section">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="Search identities..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="filter-buttons">
                <button 
                  className={activeFilter === "all" ? "active" : ""}
                  onClick={() => setActiveFilter("all")}
                >
                  All
                </button>
                <button 
                  className={activeFilter === "verified" ? "active" : ""}
                  onClick={() => setActiveFilter("verified")}
                >
                  Verified
                </button>
                <button 
                  className={activeFilter === "unverified" ? "active" : ""}
                  onClick={() => setActiveFilter("unverified")}
                >
                  Unverified
                </button>
              </div>
              <button onClick={loadCards} className="refresh-btn" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="cards-grid">
              {filteredCards.length === 0 ? (
                <div className="no-cards">
                  <p>No identity cards found</p>
                  <button onClick={() => setShowCreateModal(true)} className="create-btn">
                    Create First Identity
                  </button>
                </div>
              ) : (
                filteredCards.map((card) => (
                  <div 
                    key={card.id} 
                    className={`identity-card ${card.isVerified ? "verified" : ""}`}
                    onClick={() => setSelectedCard(card)}
                  >
                    <div className="card-header">
                      <h3>{card.name}</h3>
                      <span className={`status ${card.isVerified ? "verified" : "pending"}`}>
                        {card.isVerified ? "✅ Verified" : "🔓 Pending"}
                      </span>
                    </div>
                    <div className="card-content">
                      <p>{card.description}</p>
                      <div className="card-meta">
                        <span>Age: {card.isVerified ? card.decryptedAge : "🔒 Encrypted"}</span>
                        <span>{new Date(card.timestamp * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      {showCreateModal && (
        <CreateCardModal 
          onSubmit={createIdentityCard}
          onClose={() => setShowCreateModal(false)}
          creating={creatingCard}
          cardData={newCardData}
          setCardData={setNewCardData}
          isEncrypting={isEncrypting}
        />
      )}

      {selectedCard && (
        <CardDetailModal 
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          isDecrypting={fheIsDecrypting}
          decryptAge={() => decryptAge(selectedCard.id)}
        />
      )}

      {transactionStatus.visible && (
        <div className="transaction-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <div className="toast-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateCardModal: React.FC<{
  onSubmit: () => void;
  onClose: () => void;
  creating: boolean;
  cardData: any;
  setCardData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, cardData, setCardData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'age') {
      const intValue = value.replace(/[^\d]/g, '');
      setCardData({ ...cardData, [name]: intValue });
    } else {
      setCardData({ ...cardData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>Create FHE Identity Card</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE Age Encryption</strong>
            <p>Your age will be encrypted using Zama FHE technology</p>
          </div>
          
          <div className="form-group">
            <label>Full Name *</label>
            <input 
              type="text" 
              name="name" 
              value={cardData.name}
              onChange={handleChange}
              placeholder="Enter your name..."
            />
          </div>
          
          <div className="form-group">
            <label>Age (Integer) *</label>
            <input 
              type="number" 
              name="age" 
              value={cardData.age}
              onChange={handleChange}
              placeholder="Enter your age..."
              min="1"
              max="120"
            />
            <div className="input-note">FHE Encrypted - Only used for verification</div>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description"
              value={cardData.description}
              onChange={handleChange}
              placeholder="Brief description..."
              rows={3}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit}
            disabled={creating || isEncrypting || !cardData.name || !cardData.age}
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting..." : "Create Identity"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CardDetailModal: React.FC<{
  card: IdentityCard;
  onClose: () => void;
  isDecrypting: boolean;
  decryptAge: () => Promise<number | null>;
}> = ({ card, onClose, isDecrypting, decryptAge }) => {
  const handleVerify = async () => {
    await decryptAge();
  };

  return (
    <div className="modal-overlay">
      <div className="detail-modal">
        <div className="modal-header">
          <h2>Identity Details</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="identity-info">
            <div className="info-row">
              <span>Name:</span>
              <strong>{card.name}</strong>
            </div>
            <div className="info-row">
              <span>Age Status:</span>
              <span className={`status ${card.isVerified ? "verified" : "encrypted"}`}>
                {card.isVerified ? `Verified: ${card.decryptedAge}` : "FHE Encrypted"}
              </span>
            </div>
            <div className="info-row">
              <span>Created:</span>
              <span>{new Date(card.timestamp * 1000).toLocaleString()}</span>
            </div>
            <div className="info-row">
              <span>Creator:</span>
              <span>{card.creator.substring(0, 8)}...{card.creator.substring(34)}</span>
            </div>
          </div>
          
          <div className="description-section">
            <h3>Description</h3>
            <p>{card.description}</p>
          </div>
          
          <div className="verification-section">
            <h3>Age Verification</h3>
            <div className="verification-info">
              <p>Your age is stored encrypted on-chain. Verify it without revealing the actual number.</p>
              <button 
                onClick={handleVerify}
                disabled={isDecrypting || card.isVerified}
                className={`verify-btn ${card.isVerified ? "verified" : ""}`}
              >
                {isDecrypting ? "Verifying..." : card.isVerified ? "✅ Verified" : "🔓 Verify Age"}
              </button>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;


