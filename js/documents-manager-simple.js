/**
 * Simple Documents Manager for Shipment Tracker
 * Handles document upload, view, download, and delete operations
 */

// Global state
let currentShipmentId = null;
let allDocuments = [];
let supabase = null;

/**
 * Initialize documents manager
 */
export function initDocumentsManager(supabaseClient) {
  supabase = supabaseClient;
  setupEventListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Document upload form
  const uploadForm = document.getElementById('document-upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleDocumentUpload);
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('documents-stage-modal');
  if (modal) {
    window.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeDocumentsModal();
      }
    });
  }
}

/**
 * Open documents modal
 */
window.openDocumentsModal = async function() {
  const modal = document.getElementById('documents-stage-modal');
  if (!modal) {
    console.error('Documents modal not found');
    return;
  }
  
  modal.style.display = 'block';
  
  // Get current shipment ID from URL or global state
  currentShipmentId = getCurrentShipmentId();
  
  if (currentShipmentId) {
    await loadShipmentDocuments();
  }
};

/**
 * Close documents modal
 */
window.closeDocumentsModal = function() {
  const modal = document.getElementById('documents-stage-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

/**
 * Load all documents for current shipment
 */
async function loadShipmentDocuments() {
  const loadingDiv = document.getElementById('documents-loading');
  const gridDiv = document.getElementById('documents-grid');
  const emptyState = document.getElementById('documents-empty-state');
  
  try {
    // Show loading
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    
    // Fetch documents
    const { data, error } = await supabase
      .from('document')
      .select(`
        *,
        uploader:uploaded_by (
          full_name,
          email
        )
      `)
      .eq('shipment_id', currentShipmentId)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    
    allDocuments = data || [];
    
    // Hide loading
    if (loadingDiv) loadingDiv.style.display = 'none';
    
    // Render documents
    renderDocuments();
    
  } catch (error) {
    console.error('Error loading documents:', error);
    if (loadingDiv) loadingDiv.style.display = 'none';
    showDocumentsMessage('Failed to load documents: ' + error.message, 'error');
  }
}

/**
 * Render documents in grid
 */
function renderDocuments() {
  const gridDiv = document.getElementById('documents-grid');
  const emptyState = document.getElementById('documents-empty-state');
  const template = document.getElementById('document-card-template');
  
  if (!gridDiv || !template) return;
  
  // Clear existing documents
  gridDiv.querySelectorAll('.document-card').forEach(card => card.remove());
  
  // Show empty state if no documents
  if (allDocuments.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  
  // Render each document
  allDocuments.forEach(doc => {
    const card = template.content.cloneNode(true);
    const cardDiv = card.querySelector('.document-card');
    
    // Set data attributes
    cardDiv.dataset.docId = doc.id;
    cardDiv.dataset.fileUrl = doc.file_url;
    
    // Set icon based on file type
    const icon = card.querySelector('.document-icon i');
    const fileExt = doc.file_url.split('.').pop().toLowerCase();
    icon.className = getFileIcon(fileExt);
    
    // Set document info
    const fileName = doc.file_url.split('/').pop();
    card.querySelector('.document-title').textContent = fileName;
    card.querySelector('.document-type').textContent = formatDocType(doc.doc_type);
    
    // Set metadata
    const uploadDate = new Date(doc.uploaded_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    card.querySelector('.document-date').innerHTML = `<i class="fas fa-calendar"></i> ${uploadDate}`;
    
    const uploaderName = doc.uploader?.full_name || 'Unknown';
    card.querySelector('.document-uploader').innerHTML = `<i class="fas fa-user"></i> ${uploaderName}`;
    
    // Add to grid
    gridDiv.appendChild(card);
  });
}

/**
 * Handle document upload
 */
async function handleDocumentUpload(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const file = formData.get('document_file');
  const docType = formData.get('doc_type');
  
  try {
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB');
    }
    
    // Show loading
    showDocumentsMessage('Uploading document...', 'info');
    
    // Upload file to Supabase Storage
    const fileName = `${currentShipmentId}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('shipment-docs')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('shipment-docs')
      .getPublicUrl(fileName);
    
    // Insert document record
    const { data: { user } } = await supabase.auth.getUser();
    const { data: docData, error: docError } = await supabase
      .from('document')
      .insert({
        shipment_id: currentShipmentId,
        doc_type: docType,
        file_url: urlData.publicUrl,
        uploaded_by: user.id
      })
      .select()
      .single();
    
    if (docError) throw docError;
    
    // Success
    showDocumentsMessage('Document uploaded successfully!', 'success');
    
    // Reset form
    e.target.reset();
    
    // Reload documents
    await loadShipmentDocuments();
    
  } catch (error) {
    console.error('Error uploading document:', error);
    showDocumentsMessage('Failed to upload document: ' + error.message, 'error');
  }
}

/**
 * View document
 */
window.viewDocument = function(button) {
  const card = button.closest('.document-card');
  const fileUrl = card.dataset.fileUrl;
  window.open(fileUrl, '_blank');
};

/**
 * Download document
 */
window.downloadDocument = function(button) {
  const card = button.closest('.document-card');
  const fileUrl = card.dataset.fileUrl;
  
  const a = document.createElement('a');
  a.href = fileUrl;
  a.download = fileUrl.split('/').pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/**
 * Delete document
 */
window.deleteDocument = async function(button) {
  const card = button.closest('.document-card');
  const docId = card.dataset.docId;
  const fileUrl = card.dataset.fileUrl;
  
  if (!confirm('Are you sure you want to delete this document?')) {
    return;
  }
  
  try {
    // Delete from database
    const { error: dbError } = await supabase
      .from('document')
      .delete()
      .eq('id', docId);
    
    if (dbError) throw dbError;
    
    // Delete from storage
    const filePath = fileUrl.split('/shipment-docs/')[1];
    if (filePath) {
      await supabase
        .storage
        .from('shipment-docs')
        .remove([filePath]);
    }
    
    // Success
    showDocumentsMessage('Document deleted successfully', 'success');
    
    // Reload documents
    await loadShipmentDocuments();
    
  } catch (error) {
    console.error('Error deleting document:', error);
    showDocumentsMessage('Failed to delete document: ' + error.message, 'error');
  }
};

/**
 * Helper: Get file icon class
 */
function getFileIcon(extension) {
  const iconMap = {
    'pdf': 'fas fa-file-pdf',
    'doc': 'fas fa-file-word',
    'docx': 'fas fa-file-word',
    'xls': 'fas fa-file-excel',
    'xlsx': 'fas fa-file-excel',
    'jpg': 'fas fa-file-image',
    'jpeg': 'fas fa-file-image',
    'png': 'fas fa-file-image',
    'gif': 'fas fa-file-image'
  };
  
  return iconMap[extension] || 'fas fa-file';
}

/**
 * Helper: Format document type for display
 */
function formatDocType(docType) {
  return docType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Helper: Show message in documents modal
 */
function showDocumentsMessage(message, type) {
  const messageDiv = document.getElementById('documents-modal-message');
  if (!messageDiv) return;
  
  const className = type === 'error' ? 'error-message' : 
                   type === 'success' ? 'success-message' : 
                   'info-message';
  
  messageDiv.innerHTML = `<p class="${className}">${message}</p>`;
  messageDiv.style.display = 'block';
  
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 5000);
}

/**
 * Helper: Get current shipment ID
 */
function getCurrentShipmentId() {
  // Try to get from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  let shipmentId = urlParams.get('id');
  
  // If not in URL, try to get from global state
  if (!shipmentId && window.currentShipmentData) {
    shipmentId = window.currentShipmentData.id;
  }
  
  return shipmentId;
}
