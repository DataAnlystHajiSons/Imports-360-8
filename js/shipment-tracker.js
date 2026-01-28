    import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.4/+esm";
    import { initProductManagement } from './manage-products.js';
    
    const supabase = createClient("https://sfknzqkiqxivzcualcau.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNma256cWtpcXhpdnpjdWFsY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3OTU0ODksImV4cCI6MjA3MjM3MTQ4OX0.JKjOS9NRdbVH1UanfqmBeHmMSnlWlZtDr-5LdKw5YaA");

    const urlParams = new URLSearchParams(window.location.search);
    const shipmentId = urlParams.get("id");
    let currentStageData = {};

    const STAGE_ORDER = [
      "forecast", "enlistment_verification", "availability_confirmation", "proforma", "purchase_order",
      "ip_number", "lc_opening", "invoice", "shipment_details_from_supplier",
      "freight_query", "award_shipment", "original_docs", "non_negotiable_docs", "bank_endorsement",
      "send_to_clearing_agent", "under_clearing_agent", "release_orders", "gate_out", "transportation",
      "warehouse", "documents", "bills"
    ];

    // Store expected durations from database
    let stageExpectedDurations = {};

    const STAGE_DETAILS = {
        "forecast": { name: "Forecast", icon: "fa-solid fa-bullhorn", responsible: "Sales Team", duration: "1 day" },
        "enlistment_verification": { name: "Enlistment Verification", icon: "fa-solid fa-check-double", responsible: "Compliance", duration: "2 days" },
        "availability_confirmation": { name: "Availability Confirmation", icon: "fa-solid fa-calendar-check", responsible: "Inventory", duration: "1 day" },
        "purchase_order": { name: "Purchase Order", icon: "fa-solid fa-file-invoice", responsible: "Procurement", duration: "1 day" },
        "proforma": { name: "Proforma", icon: "fa-solid fa-file-signature", responsible: "Finance Team", duration: "2 days" },
        "invoice": { name: "Invoice", icon: "fa-solid fa-file-invoice-dollar", responsible: "Accounts", duration: "1 day" },
        "ip_number": { name: "IP Number", icon: "fa-solid fa-hashtag", responsible: "Regulatory", duration: "2 days" },
        "lc_opening": { name: "LC Management", icon: "fa-solid fa-building-columns", responsible: "Finance Team", duration: "4 days" },
        "shipment_details_from_supplier": { name: "Supplier Details", icon: "fa-solid fa-truck-fast", responsible: "Supplier Relations", duration: "1 day" },
        "freight_query": { name: "Freight Query", icon: "fa-solid fa-dolly", responsible: "Logistics", duration: "2 days" },
        "award_shipment": { name: "Award Shipment", icon: "fa-solid fa-award", responsible: "Operations", duration: "1 day" },
        "non_negotiable_docs": { name: "Non Negotiable Docs", icon: "fa-solid fa-file-contract", responsible: "Documentation", duration: "2 days" },
        "original_docs": { name: "Original Docs", icon: "fa-solid fa-file-import", responsible: "Documentation", duration: "1 day" },
        "bank_endorsement": { name: "Bank Endorsement", icon: "fa-solid fa-signature", responsible: "Banking", duration: "2 days" },
        "send_to_clearing_agent": { name: "Send to Clearing Agent", icon: "fa-solid fa-paper-plane", responsible: "Logistics", duration: "1 day" },
        "under_clearing_agent": { name: "Under Clearing Agent", icon: "fa-solid fa-user-shield", responsible: "Clearing Agent", duration: "3 days" },
        "release_orders": { name: "Release Orders", icon: "fa-solid fa-box-open", responsible: "Customs", duration: "2 days" },
        "gate_out": { name: "Gate Out", icon: "fa-solid fa-torii-gate", responsible: "Port Authority", duration: "1 day" },
        "transportation": { name: "Transportation", icon: "fa-solid fa-truck", responsible: "Transport Co.", duration: "5 days" },
        "warehouse": { name: "Warehouse", icon: "fa-solid fa-warehouse", responsible: "Warehouse Team", duration: "1 day" },
        "documents": { name: "Documents", icon: "fa-solid fa-folder-open", responsible: "Documentation Team", duration: "1 day" },
        "bills": { name: "Bills", icon: "fa-solid fa-money-bill-wave", responsible: "Finance Team", duration: "2 days" }
    };

    const STAGE_CONFIG = {
        "enlistment_verification": {
            table: "enlistment_verification",
            fields: [
                { name: "verified", type: "boolean", label: "Verified" },
                { name: "verification_notes", type: "text", label: "Verification Notes" },
                { name: "verified_at", type: "datetime-local", label: "Verified At" },
                { name: "verifier_id", type: "uuid", label: "Verifier", fk: { relation: "app_user", displayColumn: "full_name" } },
                { name: "verification_doc_url", type: "text", label: "Document URL", readonly: true }
            ]
        },
        "availability_confirmation": {
            table: "availability_confirmation",
            fields: [
                { name: "available", type: "boolean", label: "Available" },
                { name: "notes", type: "text", label: "Notes" },
                { name: "confirmed_at", type: "datetime-local", label: "Confirmed At" },
                { name: "confirmed_by", type: "uuid", label: "Confirmed By", fk: { relation: "app_user", displayColumn: "full_name" } },
                { name: "supplier_id", type: "uuid", label: "Supplier", fk: { relation: "supplier", displayColumn: "name" } }
            ]
        },
        "purchase_order": {
            table: "purchase_order",
            fields: [
                { name: "po_number", type: "text", label: "PO Number" },
                { name: "po_date", type: "date", label: "PO Date" }
            ]
        },
        "proforma": {
            table: "proforma_invoice",
            fields: [
                { name: "proforma_number", type: "text", label: "Proforma Number" },
                { name: "proforma_date", type: "date", label: "Proforma Date" }
            ]
        },
        "invoice": {
            table: "commercial_invoice",
            fields: [
                { name: "invoice_number", type: "text", label: "Invoice Number" },
                { name: "invoice_date", type: "date", label: "Invoice Date" }
            ]
        },
        "ip_number": {
            table: "ip_number",
            fields: [
                { name: "issued_date", type: "date", label: "Issued Date" },
                { name: "references", type: "jsonb", label: "IP References" }
            ]
        },
        "lc_opening": {
            table: "letter_of_credit",
            fields: [
                { name: "lc_number", type: "text", label: "LC Number" },
                { name: "opened_date", type: "date", label: "Opened Date" },
                { name: "lc_shared_date", type: "date", label: "Shared with Supplier Date" },
                { name: "notes", type: "textarea", label: "Notes" },
                { name: "bank_id", type: "uuid", label: "Bank", fk: { relation: "bank", displayColumn: "name" } }
            ]
        },
        "shipment_details_from_supplier": {
            table: "supplier_shipment_details",
            fields: [
                { name: "readiness_date", type: "date", label: "Readiness Date" },
                { name: "address", type: "text", label: "Pickup Address" },
                { name: "origin", type: "text", label: "Origin" },
                { name: "transport", type: "select", label: "Transport Mode", options: ["air", "sea", "road", "rail"] },
                { name: "inco_terms", type: "select", label: "Incoterms", options: [], dynamicOptions: true },
                { name: "container_type", type: "select", label: "Container Type", options: ["carton", "pallet"] },
                { name: "cartons_count", type: "number", label: "Cartons Count" },
                { name: "gross_weight", type: "number", label: "Gross Weight (kg)" },
                { name: "net_weight", type: "number", label: "Net Weight (kg)" },
                { name: "length", type: "number", label: "Length (cm)" },
                { name: "width", type: "number", label: "Width (cm)" },
                { name: "height", type: "number", label: "Height (cm)" },
                { name: "details_received_date", type: "date", label: "Details Received Date" }
            ]
        },
        "freight_query": {
            table: "freight_query",
            fields: [
                { name: "logistics_company_id", type: "uuid", label: "Logistics Company", fk: { relation: "logistics_company", displayColumn: "name" } },
                { name: "sent_at", type: "datetime-local", label: "Sent At" },
                { name: "term", type: "select", label: "Terms", options: ["FOB", "CIF", "CFR", "EXW", "FCA", "CPT", "CIP", "DAT", "DAP", "DDP"] },
                { name: "shipment_from", type: "text", label: "Shipment From" },
                { name: "destination", type: "text", label: "Destination" },
                { name: "origin", type: "text", label: "Origin" },
                { name: "readiness_date", type: "date", label: "Readiness Date", autoMap: "supplier_shipment_details.readiness_date" },
                { name: "gross_weight", type: "number", label: "Gross Weight (kg)", autoMap: "supplier_shipment_details.gross_weight" },
                { name: "net_weight", type: "number", label: "Net Weight (kg)" },
                { name: "chargeable_weight", type: "number", label: "Chargeable Weight (kg)" },
                { name: "no_of_cartoons", type: "number", label: "Number of Cartons", autoMap: "supplier_shipment_details.cartons_count" },
                { name: "pick_up_address", type: "text", label: "Pick Up Address" },
                { name: "remarks", type: "textarea", label: "Remarks" }
            ]
        },
        "award_shipment": {
            table: "shipment_awarded",
            fields: [
                { name: "awarded", type: "boolean", label: "Awarded" },
                { name: "notes", type: "text", label: "Notes" },
                { name: "awarded_at", type: "datetime-local", label: "Awarded At" },
                { name: "awarded_by", type: "uuid", label: "Awarded By", fk: { relation: "app_user", displayColumn: "full_name" } },
                { name: "freight_quote_response_id", type: "uuid", label: "Freight Quote Response", fk: { relation: "freight_quote_response", displayColumn: "id" } }
            ]
        },
        "non_negotiable_docs": {
            table: "non_negotiable_docs",
            fields: [
                { name: "status", type: "select", label: "Status", options: ["Sended", "Arrived", "Pending"] },
                { name: "sended_at", type: "datetime-local", label: "Sended At" },
                { name: "uploaded_by", type: "uuid", label: "Uploaded By", fk: { relation: "app_user", displayColumn: "full_name" } },
                { name: "file_url", type: "text", label: "Docs URL", readonly: true },
                { name: "bank_id", type: "uuid", label: "Bank", fk: { relation: "bank", displayColumn: "name" } }
            ]
        },
        "original_docs": {
            table: "original_docs",
            fields: [
                { name: "status", type: "text", label: "Status" },
                { name: "received_at", type: "datetime-local", label: "Received At" },
                { name: "bl_date", type: "date", label: "BL Date" },
                { name: "uploaded_by", type: "uuid", label: "Uploaded By", fk: { relation: "app_user", displayColumn: "full_name" } },
                { name: "docs_url", type: "text", label: "Docs URL", readonly: true },
                { name: "shipping_company", type: "text", label: "Shipping Company" },
                { name: "tracking_number", type: "text", label: "Tracking Number" },
                { name: "shipping_guarantee_applied_date", type: "date", label: "Shipping Guarantee Applied Date" },
                { name: "shipping_guarantee_received_date", type: "date", label: "Shipping Guarantee Received Date" },
                { name: "dispatch_date", type: "date", label: "Dispatch Date" },
                { name: "arrival_at_bank", type: "date", label: "Arrival at Bank" },
                { name: "due_date", type: "date", label: "Due Date" },
                { name: "payment_date", type: "date", label: "Payment Date" },
                { name: "bank_id", type: "uuid", label: "Bank", fk: { relation: "bank", displayColumn: "name" } }
            ]
        },
        "bank_endorsement": {
            table: "bank_endorsement",
            fields: [
                { name: "endorsed", type: "boolean", label: "Endorsed" },
                { name: "endorsed_at", type: "datetime-local", label: "Endorsed At" },
                { name: "updated_by", type: "uuid", label: "Updated By", fk: { relation: "app_user", displayColumn: "full_name" } }
            ]
        },
        "send_to_clearing_agent": {
            table: "docs_to_clearing_agent",
            fields: [
                { name: "name", type: "text", label: "Name" },
                { name: "shipping_company", type: "text", label: "Shipping Company" },
                { name: "tracking_number", type: "text", label: "Tracking Number" },
                { name: "sended_at", type: "date", label: "Sended At" },
                { name: "expected_arrival_date", type: "date", label: "Expected Arrival Date" },
                { name: "slip_picture_url", type: "text", label: "Slip Picture URL", readonly: true },
                { name: "clearing_agent_id", type: "uuid", label: "Clearing Agent", fk: { relation: "clearing_agent", displayColumn: "name" } }
            ]
        },
        "under_clearing_agent": {
            table: "under_clearing_agent",
            fields: [
                { name: "is_received", type: "boolean", label: "Received" },
                { name: "receiving_date", type: "date", label: "Receiving Date" },
                { name: "destuffed_date", type: "date", label: "Destuffed Date" },
                { name: "frsd_application_date", type: "date", label: "FRSD Application Date" },
                { name: "duty_payment_date", type: "date", label: "Duty Payment Date" },
                { name: "sampling_date", type: "date", label: "Sampling Date" },
                { name: "do_date", type: "date", label: "DO Date" },
                { name: "clearing_agent_id", type: "uuid", label: "Clearing Agent", fk: { relation: "clearing_agent", displayColumn: "name" } }
            ]
        },
        "release_orders": {
            table: "release_orders",
            fields: [
                { name: "dpp_ro_number", type: "text", label: "DPP RO Number" },
                { name: "dpp_date", type: "date", label: "DPP Date" },
                { name: "fscrd_ro_number", type: "text", label: "FSCRD RO Number" },
                { name: "fscrd_date", type: "date", label: "FSCRD Date" }
            ]
        },
        "gate_out": {
            table: "gate_out",
            fields: [
                { name: "is_gate_out", type: "boolean", label: "Gate Out" },
                { name: "gate_out_date", type: "date", label: "Gate Out Date" },
                { name: "updated_by", type: "uuid", label: "Updated By", fk: { relation: "app_user", displayColumn: "full_name" } }
            ]
        },
        "transportation": {
            table: "transporter",
            fields: [
                { name: "transporter_name", type: "text", label: "Transporter Name" },
                { name: "bilti_number", type: "text", label: "Bilti Number" },
                { name: "bilti_date", type: "date", label: "Bilti Date" },
                { name: "no_of_pieces", type: "number", label: "No of Pieces" },
                { name: "updated_by", type: "uuid", label: "Updated By", fk: { relation: "app_user", displayColumn: "full_name" } }
            ]
        },
        "warehouse": {
            table: "warehouse_arrival",
            fields: [
                { name: "warehouse_id", type: "fk", label: "Warehouse Name", fk: { relation: "warehouse", displayColumn: "warehouse_name" } },
                { name: "arrival_date", type: "date", label: "Arrival Date" },
                { name: "gr_no", type: "text", label: "GR No" },
                { name: "updated_by", type: "uuid", label: "Updated By", fk: { relation: "app_user", displayColumn: "full_name" } }
            ]
        },
        "documents": {
            table: "document",
            fields: [],
            isDocumentStage: true
        },
        "bills": {
            table: "costing",
            fields: [
                { name: "final_payment", type: "number", label: "Final Payment" },
                { name: "invoice_charges", type: "number", label: "Invoice Charges" },
                { name: "exchange_rate", type: "number", label: "Exchange Rate" },
                { name: "ip_charges", type: "number", label: "IP Charges" },
                { name: "bank_contract_opening_charges", type: "number", label: "Bank Contract Opening Charges" },
                { name: "shipping_guarantee", type: "number", label: "Shipping Guarantee" },
                { name: "fbr_duty", type: "number", label: "FBR Duty" },
                { name: "forwarder_charges", type: "number", label: "Forwarder Charges" },
                { name: "clearing_charges", type: "number", label: "Clearing Charges" },
                { name: "local_transporter", type: "number", label: "Local Transporter" },
                { name: "port_charges", type: "number", label: "Port Charges" },
                { name: "final_payment_charges", type: "number", label: "Final Payment Charges" },
                { name: "total", type: "number", label: "Total" },
                { name: "total_cost", type: "number", label: "Total Cost" },
                { name: "oh_perc", type: "number", label: "OH %" },
                { name: "qty", type: "number", label: "Qty" },
                { name: "per_unit_rate", type: "number", label: "Per Unit Rate" }
            ]
        }
    };

    function showMessage(containerId, message, isError = false) {
        const container = document.getElementById(containerId);
        container.innerHTML = `<p class="${isError ? 'error-message' : 'success-message'}">${message}</p>`;
    }

    function showToast(message, isSuccess = true) {
        const toast = document.getElementById('toast-message');
        toast.className = 'toast-notification'; // Reset classes
        if (isSuccess) {
            toast.classList.add('success');
            toast.innerHTML = `<i class="fas fa-check-circle icon"></i> ${message}`;
        } else {
            toast.classList.add('error');
            toast.innerHTML = `<i class="fas fa-exclamation-circle icon"></i> ${message}`;
        }
        
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    async function fetchStageExpectedDurations() {
        const { data, error } = await supabase
            .from("stage_details")
            .select("stage_name, expected_duration_days");
        
        if (!error && data) {
            data.forEach(stage => {
                stageExpectedDurations[stage.stage_name] = stage.expected_duration_days;
            });
        }
    }

    async function initializeTracker() {
        // Fetch expected durations from database first
        await fetchStageExpectedDurations();
        
        const { data, error } = await supabase
            .from("shipment")
            .select("*, shipment_products(*, product_variety(*, supplier(name)))")
            .eq("id", shipmentId)
            .single();

        if (error) {
            document.body.innerHTML = `<p class="error-message">Error loading shipment: ${error.message}</p>`;
            return;
        }

        const { data: checklistData, error: checklistError } = await supabase
            .from("v_shipment_stage_checklist")
            .select("*")
            .eq("shipment_id", shipmentId)
            .single();
        
        if (checklistError) {
            document.body.innerHTML = `<p class="error-message">Error loading checklist: ${checklistError.message}</p>`;
            return;
        }

        // Load supplier details for the new section
        await loadSupplierDetails(data);

        const currentStageIndex = STAGE_ORDER.indexOf(data.current_stage);

        // Update center hub
        document.querySelector('.shipment-id').textContent = data.reference_code;
        const productCount = data.shipment_products.length;
        const productElement = document.querySelector('.shipment-product');
        if (productCount > 1) {
          productElement.textContent = `${productCount} Products`;
          let productList = data.shipment_products.map(p => `${p.product_variety.product_name} - ${p.product_variety.variety_name}`).join('\n');
          productElement.title = productList;
        } else if (productCount === 1) {
          productElement.textContent = `${data.shipment_products[0].product_variety.product_name} - ${data.shipment_products[0].product_variety.variety_name}`;
        }
        
        // Display mode of transport and inco-term in center
        const modeOfTransport = data.mode_of_transport || 'sea';
        const incotermValue = data.inco_term || 'N/A';
        
        // Update inco-term display in circular tracker center
        const modeElement = document.getElementById('modeOfTransport');
        const incotermElement = document.getElementById('incotermValue');
        if (modeElement && incotermElement) {
          modeElement.textContent = modeOfTransport.charAt(0).toUpperCase() + modeOfTransport.slice(1);
          incotermElement.textContent = incotermValue;
        }
        
        const transportLabels = {
          'sea': 'Sea Freight',
          'air': 'Air Freight', 
          'land': 'Land Freight',
          'rail': 'Rail Freight',
          'multimodal': 'Multi-modal'
        };
        const transportIcons = {
          'sea': 'fa-ship',
          'air': 'fa-plane',
          'land': 'fa-truck',
          'rail': 'fa-train',
          'multimodal': 'fa-globe'
        };
        
        // Add or update transport mode display after product info
        let transportElement = document.querySelector('.transport-mode');
        if (!transportElement) {
          transportElement = document.createElement('div');
          transportElement.className = 'transport-mode';
          productElement.parentNode.insertBefore(transportElement, productElement.nextSibling);
        }
        transportElement.innerHTML = `<i class="fas ${transportIcons[modeOfTransport] || 'fa-ship'}"></i> ${transportLabels[modeOfTransport] || modeOfTransport}`;
        
        document.querySelector('.shipment-status').textContent = data.status;

        // Check if documents are uploaded (for circular tracker)
        const { data: documentsData, error: docsError } = await supabase
            .from('document')
            .select('id')
            .eq('shipment_id', shipmentId);
        
        const hasDocuments = documentsData && documentsData.length > 0;

        // Render circular progress
        const circularProgress = document.getElementById('circularProgress');
        
        // Remove existing stage nodes to prevent duplication on re-render
        const existingNodes = circularProgress.querySelectorAll('.stage-node');
        existingNodes.forEach(node => node.remove());

        const radius = 320;
        const centerX = 420;
        const centerY = 420;
        const totalStages = STAGE_ORDER.length;
        const angleIncrement = (2 * Math.PI) / totalStages;

        STAGE_ORDER.forEach((stageKey, index) => {
            const stage = STAGE_DETAILS[stageKey];
            const angle = index * angleIncrement - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle) - 40;
            const y = centerY + radius * Math.sin(angle) - 40;
            
            const stageNode = document.createElement('div');
            stageNode.className = 'stage-node';
            stageNode.style.left = `${x}px`;
            stageNode.style.top = `${y}px`;
            
            let statusClass = 'pending';
            if (index < currentStageIndex) {
                statusClass = 'completed';
            } else if (index === currentStageIndex) {
                statusClass = 'current';
            }
            
            // Special handling for documents stage in circular tracker
            if (stageKey === 'documents') {
                if (hasDocuments) {
                    statusClass = 'completed';
                } else {
                    statusClass = 'documents-pending';
                }
            }
            
            stageNode.classList.add(statusClass);
            
            stageNode.innerHTML = `
            <i class="${stage.icon} stage-icon"></i>
            <div class="stage-label">${stage.name}</div>
            <div class="tooltip">
                <strong>${stage.name}</strong><br>
                ${stage.responsible}<br>
                Duration: ${stage.duration}
            </div>
            `;

            stageNode.addEventListener('click', () => openStageModal(stageKey));
            circularProgress.appendChild(stageNode);
        });

        updateStatistics(currentStageIndex);
        populateTimeline(currentStageIndex);
        selectStage(currentStageIndex);
        
        // Initialize product management
        await initProductManagement(supabase, shipmentId, data.reference_code);
        
        // Add automatic stage checking after initial load
        await checkAndAutoAdvanceStages(data);
    }

    async function checkAndAutoAdvanceStages(shipmentData) {
        if (!shipmentId || !shipmentData) return;
        
        console.log('🔄 Checking for auto-advancement of stages...');
        
        try {
            const currentStage = shipmentData.current_stage;
            const productVarieties = shipmentData.shipment_products?.map(sp => sp.product_variety) || [];
            
            console.log('Current stage:', currentStage);
            console.log('Product varieties:', productVarieties);

            if (productVarieties.length === 0) {
                console.log('❌ No product varieties found for shipment');
                return;
            }

            // Find if there's any "Seed" commodity product
            // Need to check commodity via commodity_id relationship
            let seedProduct = null;
            for (const pv of productVarieties) {
                // Get commodity details for this product variety
                const { data: commodityData, error: commodityError } = await supabase
                    .from('commodity')
                    .select('name')
                    .eq('id', pv.commodity_id)
                    .single();
                
                if (!commodityError && commodityData) {
                    const commodityName = commodityData.name?.toUpperCase() || '';
                    if (commodityName === 'SEED' || commodityName === 'SEEDS' || commodityName.includes('SEED')) {
                        seedProduct = pv;
                        seedProduct.commodity_name = commodityData.name; // Add for logging
                        break;
                    }
                }
            }

            console.log('Seed product found:', seedProduct);

            // Auto-advance Forecast stage
            if (currentStage === 'forecast') {
                await checkAndAdvanceForecastStage(productVarieties, seedProduct);
            }
            // Auto-advance Enlistment Verification stage
            else if (currentStage === 'enlistment_verification') {
                await checkAndAdvanceEnlistmentStage(productVarieties, seedProduct);
            }

        } catch (error) {
            console.error('Error in auto-advancement check:', error);
        }
    }

    async function checkAndAdvanceForecastStage(productVarieties, seedProduct) {
        console.log('🔍 Checking Forecast stage requirements...');
        
        try {
            // If there's no seed product, mark first two stages as completed by default
            if (!seedProduct) {
                console.log('✅ No Seed product found. Auto-advancing through first two stages...');
                
                // First advance to enlistment_verification
                await advanceToNextStage('enlistment_verification', {
                    auto_advanced: true,
                    reason: 'No Seed commodity product found - auto-completing first two stages',
                    commodity_check: 'no_seed_product'
                });
                
                // Wait a moment then advance to availability_confirmation
                setTimeout(async () => {
                    await advanceToNextStage('availability_confirmation', {
                        auto_advanced: true,
                        reason: 'No Seed commodity product found - auto-completing first two stages',
                        commodity_check: 'no_seed_product'
                    });
                }, 1000);
                
                return;
            }

            // If there is a seed product, check forecast logic for that product
            console.log('🌱 Seed product found. Checking forecast requirements for:', seedProduct.product_name, '-', seedProduct.variety_name, '(Commodity:', seedProduct.commodity_name, ')');
            
            const currentYear = new Date().getFullYear();
            
            // Check if this seed product exists in forecast table for current year
            const { data: forecastData, error: forecastError } = await supabase
                .from('forecast')
                .select('*')
                .eq('product_variety_id', seedProduct.id)
                .gte('date_of_sowing', `${currentYear}-01-01`)
                .lt('date_of_sowing', `${currentYear + 1}-01-01`)
                .maybeSingle();

            if (forecastError) {
                console.error('Error checking forecast:', forecastError);
                return;
            }

            if (forecastData) {
                console.log('✅ Seed product found in forecast for current year. Advancing to next stage...');
                await advanceToNextStage('enlistment_verification', {
                    auto_advanced: true,
                    reason: 'Seed product found in forecast for current year',
                    forecast_id: forecastData.id,
                    product_variety_id: seedProduct.id,
                    commodity: seedProduct.commodity_name
                });
            } else {
                console.log('❌ Seed product not found in forecast for current year');
                showToast('Seed product not found in forecast for current year. Manual intervention required.', false);
            }

        } catch (error) {
            console.error('Error checking forecast stage:', error);
        }
    }

    async function checkAndAdvanceEnlistmentStage(productVarieties, seedProduct) {
        console.log('🔍 Checking Enlistment Verification stage requirements...');
        
        try {
            // If there's no seed product, auto-advance (this shouldn't happen if forecast logic worked correctly)
            if (!seedProduct) {
                console.log('✅ No Seed product found. Auto-advancing enlistment stage...');
                await advanceToNextStage('availability_confirmation', {
                    auto_advanced: true,
                    reason: 'No Seed commodity product found - auto-completing enlistment verification',
                    commodity_check: 'no_seed_product'
                });
                return;
            }

            // If there is a seed product, check enlistment status for that product
            console.log('🌱 Seed product found. Checking enlistment status for:', seedProduct.product_name, '-', seedProduct.variety_name, '(Commodity:', seedProduct.commodity_name, ')');
            
            const currentYear = new Date().getFullYear();
            
            // Check if enlistment_status is true in forecast table for current year
            const { data: forecastData, error: forecastError } = await supabase
                .from('forecast')
                .select('*')
                .eq('product_variety_id', seedProduct.id)
                .gte('date_of_sowing', `${currentYear}-01-01`)
                .lt('date_of_sowing', `${currentYear + 1}-01-01`)
                .eq('enlistment_status', true)
                .maybeSingle();

            if (forecastError) {
                console.error('Error checking enlistment status:', forecastError);
                return;
            }

            if (forecastData && forecastData.enlistment_status === true) {
                console.log('✅ Enlistment status is true for seed product. Advancing to next stage...');
                await advanceToNextStage('availability_confirmation', {
                    auto_advanced: true,
                    reason: 'Enlistment status verified as true for seed product',
                    forecast_id: forecastData.id,
                    product_variety_id: seedProduct.id,
                    commodity: seedProduct.commodity_name
                });
            } else {
                console.log('❌ Enlistment status is not true for seed product or forecast not found');
                showToast('Enlistment verification not completed for seed product. Manual intervention required.', false);
            }

        } catch (error) {
            console.error('Error checking enlistment stage:', error);
        }
    }

    async function advanceToNextStage(nextStage, metadata = {}) {
        console.log(`🚀 Advancing to stage: ${nextStage}`);
        
        try {
            // Call the advance_stage function
            const { data, error } = await supabase.rpc('advance_stage', {
                p_shipment_id: shipmentId,
                p_to_stage: nextStage,
                p_meta: metadata
            });

            if (error) {
                console.error('Error advancing stage:', error);
                showToast(`Error advancing to ${nextStage}: ${error.message}`, false);
                return;
            }

            console.log('✅ Stage advanced successfully');
            showToast(`Stage automatically advanced to ${nextStage.replace(/_/g, ' ')}`, true);
            
            // Refresh the tracker display
            await initializeTracker();

        } catch (error) {
            console.error('Error in advanceToNextStage:', error);
            showToast('Error advancing stage', false);
        }
    }

    function updateStatistics(currentStageIndex) {
        const completedCount = currentStageIndex;
        const totalStages = STAGE_ORDER.length;
        const progressPercent = Math.round((completedCount / totalStages) * 100);
        const remainingCount = totalStages - completedCount;

        document.getElementById('completedCount').textContent = completedCount;
        document.getElementById('progressPercent').textContent = progressPercent + '%';
        document.getElementById('remainingCount').textContent = remainingCount;
        document.getElementById('overallProgress').style.width = progressPercent + '%';
    }

    async function populateTimeline(currentStageIndex) {
        const timeline = document.getElementById('timeline');
        timeline.innerHTML = '';
        
        // Check if documents are uploaded
        const { data: documentsData, error: docsError } = await supabase
            .from('document')
            .select('id')
            .eq('shipment_id', shipmentId);
        
        const hasDocuments = documentsData && documentsData.length > 0;
        
        // Fetch audit log to calculate actual stage durations
        const { data: auditLogs, error: auditError } = await supabase
            .from('audit_log')
            .select('from_stage, to_stage, at')
            .eq('shipment_id', shipmentId)
            .order('at', { ascending: true });
        
        // Build a map of stage durations
        const stageDurations = {};
        if (!auditError && auditLogs) {
            for (let i = 0; i < auditLogs.length; i++) {
                const log = auditLogs[i];
                const nextLog = auditLogs[i + 1];
                
                if (log.to_stage && nextLog) {
                    const startTime = new Date(log.at);
                    const endTime = new Date(nextLog.at);
                    const durationDays = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));
                    stageDurations[log.to_stage] = durationDays;
                }
            }
        }
        
        STAGE_ORDER.forEach((stageKey, index) => {
            const stage = STAGE_DETAILS[stageKey];
            const expectedDuration = stageExpectedDurations[stageKey] || null;
            const actualDuration = stageDurations[stageKey] || null;
            
            let statusClass = 'pending';
            let timeText = 'Pending';
            let durationText = '';
            let exceeded = false;
            
            if (index < currentStageIndex) {
                statusClass = 'completed';
                timeText = `Completed`;
                
                if (actualDuration && expectedDuration) {
                    durationText = `${actualDuration} / ${expectedDuration} days`;
                    if (actualDuration > expectedDuration) {
                        exceeded = true;
                        statusClass += ' exceeded';
                    }
                } else if (expectedDuration) {
                    durationText = `Expected: ${expectedDuration} days`;
                }
            } else if (index === currentStageIndex) {
                statusClass = 'current';
                timeText = 'In Progress';
                if (expectedDuration) {
                    durationText = `Expected: ${expectedDuration} days`;
                }
            } else {
                if (expectedDuration) {
                    durationText = `Expected: ${expectedDuration} days`;
                }
            }
            
            // Special handling for documents stage
            let documentsClass = '';
            if (stageKey === 'documents') {
                // Documents stage is always accessible
                if (hasDocuments) {
                    statusClass = 'completed';
                    timeText = 'Documents Uploaded';
                } else {
                    statusClass = 'documents-pending';
                    timeText = 'Upload Documents';
                }
            }
            
            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item' + (exceeded ? ' timeline-item-exceeded' : '');
            timelineItem.onclick = () => {
                if (stageKey === 'documents') {
                    openDocumentsModal();
                } else {
                    openStageModal(stageKey);
                }
            };
            timelineItem.style.cursor = 'pointer';
            timelineItem.innerHTML = `
            <div class="timeline-icon ${statusClass}">
                <i class="${stage.icon}"></i>
            </div>
            <div class="timeline-content">
                <div class="timeline-title">${stage.name}${exceeded ? ' <span style="color: #EF4444; font-weight: 600;">⚠</span>' : ''}</div>
                <div class="timeline-time">${timeText}</div>
                ${durationText ? `<div class="timeline-duration ${exceeded ? 'exceeded-duration' : ''}">${durationText}</div>` : ''}
            </div>
            `;
            
            timeline.appendChild(timelineItem);
        });
    }

    function selectStage(index) {
        const stageKey = STAGE_ORDER[index];
        const stage = STAGE_DETAILS[stageKey];
        const detailsContainer = document.getElementById('currentStageDetails');
        
        let statusText = 'Pending';
        if (index < STAGE_ORDER.indexOf(currentStageData.current_stage)) {
            statusText = 'Completed';
        } else if (index === STAGE_ORDER.indexOf(currentStageData.current_stage)) {
            statusText = 'In Progress';
        }

        detailsContainer.innerHTML = `
            <h4>${stage.name}</h4>
            <div class="detail-item">
            <span class="detail-label">Responsible:</span>
            <span class="detail-value">${stage.responsible}</span>
            </div>
            <div class="detail-item">
            <span class="detail-label">Status:</span>
            <span class="detail-value">${statusText}</span>
            </div>
        `;
    }

    async function openStageModal(stageName) {
        // Special handling for documents stage - open documents modal instead
        if (stageName === 'documents') {
            openDocumentsModal();
            return;
        }
        
        const modal = document.getElementById('stage-modal');
        const modalTitle = document.getElementById('modal-title');
        const table = document.getElementById('stage-details-table');
        const editContainer = document.getElementById('stage-edit-container');
        const editButton = document.getElementById('edit-stage-button');

        // Show modal with loading state
        modalTitle.innerText = 'Loading...';
        table.innerHTML = '<tr><td>Loading stage details...</td></tr>';
        editContainer.style.display = 'none';
        editButton.style.display = 'none';
        modal.classList.add('show');

        console.log('openStageModal called with stageName:', stageName);
        const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipment')
        .select('current_stage')
        .eq('id', shipmentId)
        .single();

        if (shipmentError) {
            showMessage('stage-modal-message', `Error fetching shipment data: ${shipmentError.message}`, true);
            setTimeout(() => closeModal(), 2000);
            return;
        }

        const currentShipmentStage = shipmentData.current_stage;
        const currentStageIndex = STAGE_ORDER.indexOf(currentShipmentStage);
        const clickedStageIndex = STAGE_ORDER.indexOf(stageName);

        if (stageName !== 'bills' && stageName !== 'documents' && clickedStageIndex > currentStageIndex + 1) {
            showToast('You must complete the previous stages first.', false);
            closeModal();
            return;
        }

        if (!stageName || !STAGE_CONFIG[stageName]) {
            console.error("Invalid stage name or configuration for:", stageName);
            closeModal();
            return;
        }
        currentStageData.stageName = stageName;
        const config = STAGE_CONFIG[stageName];
        currentStageData.config = config;
        modalTitle.innerText = stageName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        showMessage('stage-modal-message', '');
        
        await renderStageView();
        console.log('Showing stage modal.');
    }

    async function renderStageView() {
        const viewContainer = document.getElementById('stage-view-container');
        const editContainer = document.getElementById('stage-edit-container');
        const table = document.getElementById('stage-details-table');
        const config = currentStageData.config;
        
        let selectString = '*';
        config.fields.forEach(field => {
            if (field.fk) {
                const relationName = field.fk.relation;
                const displayColumn = field.fk.displayColumn;
                selectString += `, ${relationName}(${displayColumn})`;
            }
        });

        let data, error;
        
        if (currentStageData.stageName === 'freight_query') {
            const { data: queryData, error: queryError } = await supabase
                .from(config.table)
                .select(selectString)
                .eq("shipment_id", shipmentId)
                .order('sent_at', { ascending: false })
                .limit(1);
            
            data = queryData && queryData.length > 0 ? queryData[0] : null;
            error = queryError;
        } else {
            const { data: queryData, error: queryError } = await supabase
                .from(config.table)
                .select(selectString)
                .eq("shipment_id", shipmentId)
                .maybeSingle();
            data = queryData;
            error = queryError;
        }

        if (error && error.code !== 'PGRST116') {
            showMessage('stage-modal-message', `Error loading stage details: ${error.message}`, true);
            return;
        }
        
        currentStageData.details = data || {};

        table.innerHTML = ''; // Clear previous data

        if (currentStageData.stageName === 'ip_number') {
            // Custom rendering for ip_number stage
            const issuedDateField = currentStageData.config.fields.find(f => f.name === 'issued_date');

            let issuedDateValue = currentStageData.details.issued_date || 'N/A';
            
            table.innerHTML += `<tr><td>${issuedDateField.label}</td><td>${issuedDateValue}</td></tr>`;
            
            if (currentStageData.details.file_url) {
                const fileUrlValue = `<a href="${currentStageData.details.file_url}" target="_blank" class="button button-secondary">View Document</a>`;
                table.innerHTML += `<tr><td>Document URL</td><td>${fileUrlValue}</td></tr>`;
            }

            const references = currentStageData.details.references || [];
            if (references.length > 0) {
                const productVarietyIds = references.map(r => r.product_variety_id);
                const { data: products, error } = await supabase
                    .from('product_variety')
                    .select('id, product_name, variety_name')
                    .in('id', productVarietyIds);

                if (error) {
                    showMessage('stage-modal-message', `Error loading products: ${error.message}`, true);
                } else {
                    let referencesHtml = '<tr><td colspan="2"><h3>IP References</h3></td></tr>';
                    references.forEach(ref => {
                        const product = products.find(p => p.id === ref.product_variety_id);
                        const productName = product ? `${product.product_name} - ${product.variety_name}` : 'Unknown Product';
                        referencesHtml += `<tr><td>${productName}</td><td>${ref.ip_reference}</td></tr>`;
                    });
                    table.innerHTML += referencesHtml;
                }
            }
        } else {
            for (const field of currentStageData.config.fields) {
                let value = currentStageData.details[field.name];
                let displayValue = value;

                if (value === null || value === undefined || value === 'null') {
                    displayValue = 'N/A';
                }

                if (field.fk) {
                    const relationName = field.fk.relation;
                    const relatedData = currentStageData.details[relationName];
                    if (relatedData && relatedData[field.fk.displayColumn]) {
                        displayValue = relatedData[field.fk.displayColumn];
                    } else if (value === null || value === undefined || value === 'null') {
                        displayValue = 'N/A';
                    }
                }

                if (field.type === 'boolean') {
                    displayValue = value ? 'Yes' : 'No';
                }

                if (field.name.endsWith('_url') || field.name.endsWith('_doc')) {
                    if (value && value !== 'null') {
                        displayValue = `<a href="${value}" target="_blank" class="button button-secondary">View Document</a>`;
                    } else {
                        displayValue = 'N/A';
                    }
                }

                const row = table.insertRow();
                row.innerHTML = `<td>${field.label}</td><td>${displayValue || 'N/A'}</td>`;
            }
        }

        const buttonContainer = viewContainer.querySelector('.button-container');
        if (buttonContainer) {
            buttonContainer.innerHTML = '<button id="edit-stage-button" onclick="renderStageEdit()">Edit</button>';
        }

        viewContainer.style.display = 'block';
        editContainer.style.display = 'none';
        document.getElementById('edit-stage-button').style.display = 'block';
        document.getElementById('save-stage-button').style.display = 'none';
        document.getElementById('cancel-edit-button').style.display = 'none';
    }

    async function renderStageEdit() {
        const viewContainer = document.getElementById('stage-view-container');
        const editContainer = document.getElementById('stage-edit-container');
        const form = document.getElementById('modal-form');
        form.innerHTML = ''; // Clear previous form
        const config = currentStageData.config;
        const data = currentStageData.details;

        if (currentStageData.stageName === 'ip_number') {
            // Custom rendering for ip_number stage
            const issuedDateField = config.fields.find(f => f.name === 'issued_date');
            
            form.innerHTML += `
                <div class="form-field">
                    <label for="issued_date">${issuedDateField.label}:</label>
                    <input type="date" id="issued_date" name="issued_date" value="${data.issued_date || ''}">
                </div>
            `;

            // Get products for the shipment
            const { data: shipmentProducts, error } = await supabase
                .from('shipment_products')
                .select('*, product_variety(*)')
                .eq('shipment_id', shipmentId);

            if (error) {
                showMessage('stage-modal-message', `Error loading products: ${error.message}`, true);
                return;
            }

            // Render a list of products with input fields for IP references
            let referencesHtml = '<h3>IP References</h3>';
            const existingReferences = data.references || [];

            shipmentProducts.forEach(sp => {
                const productVariety = sp.product_variety;
                const existingRef = existingReferences.find(ref => ref.product_variety_id === productVariety.id);
                referencesHtml += `
                    <div class="form-field">
                        <label for="ip_ref_${productVariety.id}">${productVariety.product_name} - ${productVariety.variety_name}</label>
                        <input type="text" id="ip_ref_${productVariety.id}" name="ip_reference" data-product-variety-id="${productVariety.id}" value="${existingRef ? existingRef.ip_reference : ''}">
                    </div>
                `;
            });
            form.innerHTML += referencesHtml;
        } else {
            // Debug the shipment ID  
            if (currentStageData.stageName === 'freight_query') {
                console.log('🔍 Freight Query Debug - renderStageEdit:');
                console.log('📊 Data loaded:', data);
            }

            for (const field of config.fields) {
                let value = data ? data[field.name] : '';
                
                // Properly handle null values from database
                if (value === null || value === undefined || value === 'null') {
                    value = '';
                }
                
                // Fix datetime-local format for display
                if (field.type === 'datetime-local' && value) {
                    // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:MM)
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        // Format to YYYY-MM-DDTHH:MM format required by datetime-local input
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const hours = String(date.getHours()).padStart(2, '0');
                        const minutes = String(date.getMinutes()).padStart(2, '0');
                        value = `${year}-${month}-${day}T${hours}:${minutes}`;
                    }
                }
                
                const formField = document.createElement('div');
                formField.classList.add('form-field');
                let fieldHtml = `<label for="${field.name}">${field.label}:</label>`;
                if (field.type === 'select') {
                    fieldHtml += `<select id="${field.name}" name="${field.name}">`;
                    field.options.forEach(option => {
                        fieldHtml += `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`;
                    });
                    fieldHtml += `</select>`;
                } else if (field.fk) {
                    fieldHtml += `<select id="${field.name}" name="${field.name}"></select>`;
                } else if (field.type === 'boolean') {
                    fieldHtml += `<label class="switch">
                                        <input type="checkbox" id="${field.name}" name="${field.name}" ${value ? 'checked' : ''}>
                                        <span class="slider round"></span>
                                    </label>`;
                } else if (field.type === 'jsonb') {
                    fieldHtml += `<textarea id="${field.name}" name="${field.name}">${value ? JSON.stringify(value, null, 2) : ''}</textarea>`;
                } else if (field.type === 'textarea') {
                    fieldHtml += `<textarea id="${field.name}" name="${field.name}" rows="4">${value || ''}</textarea>`;
                } else {
                    fieldHtml += `<input type="${field.type}" id="${field.name}" name="${field.name}" value="${value || ''}" ${field.readonly ? 'readonly' : ''}>`;
                }
                formField.innerHTML = fieldHtml;
                form.appendChild(formField);
            }
        }

        // Populate foreign key dropdowns and special fields
        for (const field of config.fields) {
            if (field.fk) {
                if (currentStageData.stageName === 'award_shipment' && field.name === 'freight_quote_response_id') {
                    const { data: freightQueries, error: fqError } = await supabase
                        .from('freight_query')
                        .select('id')
                        .eq('shipment_id', shipmentId);

                    if (fqError) {
                        console.error('Error loading freight queries:', fqError);
                        continue;
                    }

                    const freightQueryIds = freightQueries.map(fq => fq.id);

                    const { data: fkData, error: fkError } = await supabase
                        .from('freight_quote_response')
                        .select(`id, freight_query (*, logistics_company(name)) `)
                        .in('freight_query_id', freightQueryIds);

                    if (fkError) {
                        console.error(`Error loading data for ${field.fk.relation}:`, fkError);
                        continue;
                    }
                    const select = document.getElementById(field.name);
                    fkData.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = item.freight_query.logistics_company.name;
                        if (data && data[field.name] === item.id) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                } else {
                    const { data: fkData, error: fkError } = await supabase.from(field.fk.relation).select(`id, ${field.fk.displayColumn}`);
                    if (fkError) {
                        console.error(`Error loading data for ${field.fk.relation}:`, fkError);
                        continue;
                    }
                    const select = document.getElementById(field.name);
                    fkData.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = item[field.fk.displayColumn];
                        if (data && data[field.name] === item.id) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
            } else if (currentStageData.stageName === 'award_shipment' && field.name === 'awarded_by') {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                document.getElementById(field.name).value = user.id;
                document.getElementById(field.name).readOnly = true;
                }
            }
        }

        // Dynamic Incoterms dropdown for shipment_details_from_supplier stage
        if (currentStageData.stageName === 'shipment_details_from_supplier') {
            console.log('🔄 Setting up dynamic Incoterms dropdown...');
            
            // Get the shipment's mode_of_transport
            const { data: shipmentData, error: shipmentError } = await supabase
                .from('shipment')
                .select('mode_of_transport')
                .eq('id', shipmentId)
                .single();
            
            if (shipmentError) {
                console.warn('⚠️ Could not load shipment mode_of_transport:', shipmentError.message);
            } else {
                const modeOfTransport = shipmentData.mode_of_transport || 'sea';
                console.log('📦 Mode of transport:', modeOfTransport);
                
                // Define Incoterms options based on mode of transport
                const incotermsOptions = {
                    'sea': ['EXW', 'FOB', 'CFR', 'DDP'],
                    'air': ['EXW', 'FCA', 'CPT', 'DDP']
                };
                
                // Get the options for the current mode (default to sea if not found)
                const options = incotermsOptions[modeOfTransport] || incotermsOptions['sea'];
                
                // Populate the inco_terms dropdown
                const incoTermsSelect = document.getElementById('inco_terms');
                if (incoTermsSelect) {
                    // Clear existing options
                    incoTermsSelect.innerHTML = '';
                    
                    // Add empty option
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = '-- Select Incoterms --';
                    incoTermsSelect.appendChild(emptyOption);
                    
                    // Add options based on mode of transport
                    options.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        // Select current value if it exists
                        if (data && data.inco_terms === option) {
                            optionElement.selected = true;
                        }
                        incoTermsSelect.appendChild(optionElement);
                    });
                    
                    console.log(`✅ Populated Incoterms dropdown with options for ${modeOfTransport}:`, options);
                }
            }
        }

        // Auto-mapping for freight_query stage
        // Note: Database trigger handles auto-mapping on save, this pre-fills the form for user convenience
        if (currentStageData.stageName === 'freight_query') {
            console.log('🔄 Pre-filling freight query form with supplier details...');
            
            try {
                // Always fetch supplier data to show in the form
                const { data: supplierData, error: supplierError } = await supabase
                    .from('supplier_shipment_details')
                    .select('*')
                    .eq('shipment_id', shipmentId)
                    .single();

                if (supplierError && supplierError.code !== 'PGRST116') {
                    console.warn('⚠️ Could not load supplier shipment details:', supplierError.message);
                } else if (supplierData) {
                    // Map fields
                    const mappings = {
                        'shipment_from': supplierData.origin,
                        'destination': 'Karachi', // Default
                        'origin': supplierData.origin,
                        'readiness_date': supplierData.readiness_date,
                        'gross_weight': supplierData.gross_weight,
                        'net_weight': supplierData.net_weight,
                        'no_of_cartoons': supplierData.cartons_count,
                        'pick_up_address': supplierData.address
                    };

                    // Apply mappings if fields are empty
                    Object.entries(mappings).forEach(([fieldId, value]) => {
                        const element = document.getElementById(fieldId);
                        if (element && !element.value && value) {
                            element.value = value;
                        }
                    });
                }
            } catch (err) {
                console.error('Error in freight query auto-mapping:', err);
            }
        }

        // Setup calculations for bills stage
        if (currentStageData.stageName === 'bills') {
            setupBillsCalculations();
        }

        // Document upload container removed - now using centralized "Manage Documents" button
        
        viewContainer.style.display = 'none';
        editContainer.style.display = 'block';
        document.getElementById('edit-stage-button').style.display = 'none';
        document.getElementById('save-stage-button').style.display = 'block';
        document.getElementById('cancel-edit-button').style.display = 'block';
    }

    async function saveStageDetails() {
        const modalLoader = document.querySelector('#stage-modal .modal-loader');
        try {
            modalLoader.style.display = 'flex';
            
            const stageName = currentStageData.stageName;
            const config = STAGE_CONFIG[stageName];
            const form = document.getElementById('modal-form');
            const formData = new FormData(form);
            const updates = { 
                shipment_id: shipmentId
            };

            if (stageName === 'ip_number') {
                const references = [];
                const ipReferenceInputs = form.querySelectorAll('input[name="ip_reference"]');
                ipReferenceInputs.forEach(input => {
                    references.push({
                        product_variety_id: input.dataset.productVarietyId,
                        ip_reference: input.value
                    });
                });
                updates['references'] = references;
                updates['issued_date'] = formData.get('issued_date');
            } else {
                const fileUrlField = config.fields.find(f => f.name.endsWith('_url') || f.name.endsWith('_doc'));
                for (const field of config.fields) {
                    const key = field.name;
                    if (key === (fileUrlField ? fileUrlField.name : '')) continue;

                    let value = formData.get(key);

                    if (field.type === 'boolean') {
                        updates[key] = form.querySelector(`[name="${key}"]`).checked;
                    } else if (field.type === 'datetime-local') {
                        if (value && value !== 'null' && value !== '') {
                            const date = new Date(value);
                            updates[key] = date.toISOString();
                        } else {
                            updates[key] = null;
                        }
                    } else if (field.type === 'jsonb') {
                        try {
                            updates[key] = value && value !== 'null' && value !== '' ? JSON.parse(value) : null;
                        } catch (e) {
                            showMessage("stage-modal-message", `<p class="error-message">Invalid JSON in ${field.label}</p>`);
                            return;
                        }
                    } else if (field.type === 'uuid' && (!value || value === 'null' || value === '')) {
                        if (field.fk) {
                            updates[key] = null;
                        } else {
                            continue;
                        }
                    } else if (field.type !== 'file') {
                        if (value === null || value === undefined || value === '' || value === 'null') {
                            updates[key] = null;
                        } else {
                            updates[key] = value;
                        }
                    }
                }
            }

            // Document upload removed - use centralized "Manage Documents" button instead

            Object.keys(updates).forEach(key => {
                if (updates[key] === undefined) {
                    delete updates[key];
                }
            });

            let query;
            if (stageName === 'freight_query') {
                if (currentStageData.details && currentStageData.details.id) {
                    query = supabase.from(config.table).update(updates).eq('id', currentStageData.details.id);
                } else {
                    query = supabase.from(config.table).insert(updates);
                }
            } else {
                query = supabase.from(config.table).upsert(updates, {
                    onConflict: 'shipment_id'
                });
            }

            const { data: queryResult, error: upsertError } = await query;

            if (upsertError) {
                console.error('Insert/Upsert failed:', upsertError);
                showMessage("stage-modal-message", `<p class="error-message">Error saving details: ${upsertError.message}<br>Details: ${upsertError.details || 'N/A'}</p>`);
                return;
            }

            const { data: checklistData, error: checklistError } = await supabase
                .from('v_shipment_stage_checklist')
                .select('current_stage')
                .eq('shipment_id', shipmentId)
                .single();

            if (checklistError) {
                showMessage('stage-modal-message', `Error fetching current stage: ${checklistError.message}`, true);
                return;
            }
            
            if (stageName !== checklistData.current_stage) {
                closeModal();
                await initializeTracker();
                showToast(`${stageName.replace(/_/g, ' ')} data updated successfully!`, true);
                return;
            }
            
            if (stageName === 'bills' && checklistData.current_stage !== 'warehouse') {
                closeModal();
                initializeTracker();
                showToast('Bills updated successfully!', true);
                return;
            }

            const { data: nextStageData, error: nextStageError } = await supabase
                .from('stage_edge')
                .select('to_stage')
                .eq('from_stage', checklistData.current_stage);

            if (nextStageError) {
                showMessage('stage-modal-message', `Error fetching next stage: ${nextStageError.message}`, true);
                return;
            }

            if (!nextStageData || nextStageData.length === 0) {
                closeModal();
                initializeTracker();
                showToast('Stage updated successfully!', true);
                return;
            }

            const nextStage = nextStageData[0].to_stage;

            const { error: advanceStageError } = await supabase.rpc('advance_stage', {
                p_shipment_id: shipmentId,
                p_to_stage: nextStage,
                p_meta: { manual: true }
            });

            if (advanceStageError) {
                if (advanceStageError.message.includes('Requirements not met')) {
                    showMessage("stage-modal-message", `<p class="warning-message">Data saved, but the stage cannot be advanced. Please ensure all required fields are filled. Reason: ${advanceStageError.message}</p>`);
                    initializeTracker();
                } else {
                    showMessage("stage-modal-message", `<p class="error-message">Error advancing stage: ${advanceStageError.message}<br>Details: ${advanceStageError.details || 'N/A'}</p>`);
                }
            } else {
                closeModal();
                initializeTracker();
                showToast('Stage updated and advanced successfully!', true);
            }
        } finally {
            modalLoader.style.display = 'none';
        }
    }

    function closeModal() {
        const modal = document.getElementById('stage-modal');
        modal.classList.remove('show');
    }

    let bankChargesData = {};

    async function openBankChargesModal() {
        const modal = document.getElementById('bank-charges-modal');
        modal.classList.add('show');
        
        const { data, error } = await supabase
            .from('bank_charges')
            .select(`
                *,
                issuance (*),
                amendment (*),
                final_payment (*),
                bank_charge_documents (*)
            `)
            .eq('shipment_id', shipmentId)
            .single();

        if (error && error.code !== 'PGRST116') {
            showMessage('bank-charges-modal-message', `Error loading bank charges: ${error.message}`, true);
            return;
        }
        bankChargesData = data || {};
        renderBankChargesView();
    }

    function renderBankChargesView() {
        const viewContainer = document.getElementById('bank-charges-view-container');
        const editContainer = document.getElementById('bank-charges-edit-container');
        const detailsTable = document.getElementById('bank-charges-details-table');

        let html = '<div class="form-section"><h3>Main Details</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">USD Amount:</span><span class="detail-value">${bankChargesData.usd_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Rate:</span><span class="detail-value">${bankChargesData.rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">RS:</span><span class="detail-value">${bankChargesData.rs || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">LC Issuance Date:</span><span class="detail-value">${bankChargesData.lc_issuance_date || 'N/A'}</span></div>`;
        html += '</div></div>';

        if (bankChargesData.issuance && bankChargesData.issuance.length > 0) {
            const issuance = bankChargesData.issuance[0];
            html += '<div class="form-section"><h3>Issuance Charges</h3><div class="form-grid">';
            html += `<div class="detail-item"><span class="detail-label">Services Charges Amount:</span><span class="detail-value">${issuance.services_charges_amount || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Services Charges (%):</span><span class="detail-value">${issuance.services_charges_per || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Swift Amount:</span><span class="detail-value">${issuance.swift_amount || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Swift (%):</span><span class="detail-value">${issuance.swift_percentage || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">FED Amount:</span><span class="detail-value">${issuance.fed_amount || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">FED (%):</span><span class="detail-value">${issuance.fed_per || 'N/A'}</span></div>`;
            html += '</div></div>';
        }

        if (bankChargesData.amendment && bankChargesData.amendment.length > 0) {
            const amendment = bankChargesData.amendment[0];
            html += '<div class="form-section"><h3>Amendment Charges</h3><div class="form-grid">';
            html += `<div class="detail-item"><span class="detail-label">Amendment Charges Amount:</span><span class="detail-value">${amendment.amendment_charges_amount || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Amendment Charges (%):</span><span class="detail-value">${amendment.amendment_charges_per || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">FED Amount:</span><span class="detail-value">${amendment.fed_amount || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">FED (%):</span><span class="detail-value">${amendment.fed_per || 'N/A'}</span></div>`;
            html += '</div></div>';
        }

        if (bankChargesData.final_payment && bankChargesData.final_payment.length > 0) {
            const final_payment = bankChargesData.final_payment[0];
            html += '<div class="form-section"><h3>Final Payment Charges</h3><div class="form-grid">';
            html += `<div class="detail-item"><span class="detail-label">Services Charges Amount:</span><span class="detail-value">${final_payment.services_charges_amount || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Services Charges (%):</span><span class="detail-value">${final_payment.services_charges_per || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">FED Amount:</span><span class="detail-value">${final_payment.fed_amount || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">FED (%):</span><span class="detail-value">${final_payment.fed_per || 'N/A'}</span></div>`;
            html += '</div></div>';
        }

        if (bankChargesData.bank_charge_documents && bankChargesData.bank_charge_documents.length > 0) {
            html += '<div class="form-section"><h3>Documents</h3><ul>';
            bankChargesData.bank_charge_documents.forEach(doc => {
                html += `<li><a href="${doc.file_url}" target="_blank">${doc.file_name}</a> (${doc.doc_category || 'No Category'})</li>`;
            });
            html += '</ul></div>';
        }

        detailsTable.innerHTML = html;

        viewContainer.style.display = 'block';
        editContainer.style.display = 'none';
    }

    function renderBankChargesEdit() {
        const viewContainer = document.getElementById('bank-charges-view-container');
        const editContainer = document.getElementById('bank-charges-edit-container');

        document.getElementById('bank_charges_id').value = bankChargesData.id || '';
        document.getElementById('bc_usd_amount').value = bankChargesData.usd_amount || '';
        document.getElementById('bc_rate').value = bankChargesData.rate || '';
        document.getElementById('bc_rs').value = bankChargesData.rs || '';
        document.getElementById('bc_lc_issuance_date').value = bankChargesData.lc_issuance_date || '';

        if (bankChargesData.issuance && bankChargesData.issuance.length > 0) {
            const issuance = bankChargesData.issuance[0];
            document.getElementById('bc_issuance_services_charges_amount').value = issuance.services_charges_amount || '';
            document.getElementById('bc_issuance_services_charges_per').value = issuance.services_charges_per || '';
            document.getElementById('bc_issuance_swift_amount').value = issuance.swift_amount || '';
            document.getElementById('bc_issuance_swift_percentage').value = issuance.swift_percentage || '';
            document.getElementById('bc_issuance_fed_amount').value = issuance.fed_amount || '';
            document.getElementById('bc_issuance_fed_per').value = issuance.fed_per || '';
        }

        if (bankChargesData.amendment && bankChargesData.amendment.length > 0) {
            const amendment = bankChargesData.amendment[0];
            document.getElementById('bc_amendment_charges_amount').value = amendment.amendment_charges_amount || '';
            document.getElementById('bc_amendment_charges_per').value = amendment.amendment_charges_per || '';
            document.getElementById('bc_amendment_fed_amount').value = amendment.fed_amount || '';
            document.getElementById('bc_amendment_fed_per').value = amendment.fed_per || '';
        }

        if (bankChargesData.final_payment && bankChargesData.final_payment.length > 0) {
            const final_payment = bankChargesData.final_payment[0];
            document.getElementById('bc_final_payment_services_charges_amount').value = final_payment.services_charges_amount || '';
            document.getElementById('bc_final_payment_services_charges_per').value = final_payment.services_charges_per || '';
            document.getElementById('bc_final_payment_fed_amount').value = final_payment.fed_amount || '';
            document.getElementById('bc_final_payment_fed_per').value = final_payment.fed_per || '';
        }

        const documentsList = document.getElementById('bank-charge-documents-list');
        documentsList.innerHTML = '';
        if (bankChargesData.bank_charge_documents && bankChargesData.bank_charge_documents.length > 0) {
            let docsHtml = '<h4>Uploaded Documents</h4><ul>';
            bankChargesData.bank_charge_documents.forEach(doc => {
                docsHtml += `<li><a href="${doc.file_url}" target="_blank">${doc.file_name}</a> (${doc.doc_category || 'No Category'})</li>`;
            });
            docsHtml += '</ul>';
            documentsList.innerHTML = docsHtml;
        }

        viewContainer.style.display = 'none';
        editContainer.style.display = 'block';

        // Add event listeners for auto-calculation
        const fieldsToWatch = [
            'bc_usd_amount',
            'bc_rate',
            'bc_issuance_services_charges_amount',
            'bc_issuance_swift_amount',
            'bc_issuance_fed_amount',
        ];
        fieldsToWatch.forEach(fieldId => {
            document.getElementById(fieldId).addEventListener('input', calculateBankChargesOnChange);
        });
    }

    function cancelBankChargesEdit() {
        renderBankChargesView();
    }

    function closeBankChargesModal() {
        const modal = document.getElementById('bank-charges-modal');
        modal.classList.remove('show');
    }

    function getNumericValue(id) {
        const value = document.getElementById(id).value;
        return value === '' ? null : value;
    }

    async function saveBankCharges() {
        const bankChargesId = document.getElementById('bank_charges_id').value;
        const { data: { user } } = await supabase.auth.getUser();

        const bankChargesData = {
            shipment_id: shipmentId,
            usd_amount: getNumericValue('bc_usd_amount'),
            rate: getNumericValue('bc_rate'),
            rs: getNumericValue('bc_rs'),
            lc_issuance_date: document.getElementById('bc_lc_issuance_date').value || null,
            created_by: user.id
        };

        let bcId = bankChargesId;

        if (bankChargesId) {
            const { error } = await supabase.from('bank_charges').update(bankChargesData).eq('id', bankChargesId);
            if (error) {
                showMessage('bank-charges-modal-message', `Error updating bank charges: ${error.message}`, true);
                return;
            }
        } else {
            const { data, error } = await supabase.from('bank_charges').insert(bankChargesData).select().single();
            if (error) {
                showMessage('bank-charges-modal-message', `Error creating bank charges: ${error.message}`, true);
                return;
            }
            bcId = data.id;
            document.getElementById('bank_charges_id').value = bcId;
        }

        const issuanceData = {
            bank_charges_id: bcId,
            shipment_id: shipmentId,
            services_charges_amount: getNumericValue('bc_issuance_services_charges_amount'),
            services_charges_per: getNumericValue('bc_issuance_services_charges_per'),
            swift_amount: getNumericValue('bc_issuance_swift_amount'),
            swift_percentage: getNumericValue('bc_issuance_swift_percentage'),
            fed_amount: getNumericValue('bc_issuance_fed_amount'),
            fed_per: getNumericValue('bc_issuance_fed_per'),
            created_by: user.id
        };
        const { error: issuanceError } = await supabase.from('issuance').upsert(issuanceData, { onConflict: 'bank_charges_id' });
        if (issuanceError) {
            showMessage('bank-charges-modal-message', `Error saving issuance charges: ${issuanceError.message}`, true);
            return;
        }

        const amendmentData = {
            bank_charges_id: bcId,
            shipment_id: shipmentId,
            amendment_charges_amount: getNumericValue('bc_amendment_charges_amount'),
            amendment_charges_per: getNumericValue('bc_amendment_charges_per'),
            fed_amount: getNumericValue('bc_amendment_fed_amount'),
            fed_per: getNumericValue('bc_amendment_fed_per'),
            created_by: user.id
        };
        const { error: amendmentError } = await supabase.from('amendment').upsert(amendmentData, { onConflict: 'bank_charges_id' });
        if (amendmentError) {
            showMessage('bank-charges-modal-message', `Error saving amendment charges: ${amendmentError.message}`, true);
            return;
        }

        const finalPaymentData = {
            bank_charges_id: bcId,
            shipment_id: shipmentId,
            services_charges_amount: getNumericValue('bc_final_payment_services_charges_amount'),
            services_charges_per: getNumericValue('bc_final_payment_services_charges_per'),
            fed_amount: getNumericValue('bc_final_payment_fed_amount'),
            fed_per: getNumericValue('bc_final_payment_fed_per'),
            created_by: user.id
        };
        const { error: finalPaymentError } = await supabase.from('final_payment').upsert(finalPaymentData, { onConflict: 'bank_charges_id' });
        if (finalPaymentError) {
            showMessage('bank-charges-modal-message', `Error saving final payment charges: ${finalPaymentError.message}`, true);
            return;
        }

        showToast('Bank charges saved successfully!', true);
        await openBankChargesModal();
    }

    async function calculateBankChargesOnChange() {
        const input = {
            usd_amount: parseFloat(document.getElementById('bc_usd_amount').value) || 0,
            rate: parseFloat(document.getElementById('bc_rate').value) || 0,
            services_charges_amount: parseFloat(document.getElementById('bc_issuance_services_charges_amount').value) || 0,
            swift_amount: parseFloat(document.getElementById('bc_issuance_swift_amount').value) || 0,
            fed_amount: parseFloat(document.getElementById('bc_issuance_fed_amount').value) || 0,
        };

        const { data, error } = await supabase.functions.invoke('calculate-bank-charges', {
            body: { input },
        });

        if (error) {
            console.error('Error calculating bank charges:', error);
            return;
        }

        const calcs = data.calculations;
        document.getElementById('bc_rs').value = calcs.rs;
        document.getElementById('bc_issuance_services_charges_per').value = calcs.services_charges_per;
        document.getElementById('bc_issuance_swift_percentage').value = calcs.swift_percentage;
        document.getElementById('bc_issuance_fed_per').value = calcs.fed_per;
    }

    function addDocumentForm() {
        const container = document.getElementById('add-document-form-container');
        const formHtml = `
            <div class="form-grid">
                <div class="form-group">
                    <label for="new_doc_name">File Name</label>
                    <input type="text" id="new_doc_name" name="new_doc_name">
                </div>
                <div class="form-group">
                    <label for="new_doc_category">File Category</label>
                    <input type="text" id="new_doc_category" name="new_doc_category">
                </div>
                <div class="form-group">
                    <label for="new_doc_file">File</label>
                    <input type="file" id="new_doc_file" name="new_doc_file">
                </div>
            </div>
            <button type="button" onclick="saveBankChargeDocument()">Save Document</button>
            <button type="button" class="button-secondary" onclick="cancelAddDocument()">Cancel</button>
        `;
        container.innerHTML = formHtml;
    }

    function cancelAddDocument() {
        const container = document.getElementById('add-document-form-container');
        container.innerHTML = '';
    }

    async function saveBankChargeDocument() {
        let bankChargesId = document.getElementById('bank_charges_id').value;
        const { data: { user } } = await supabase.auth.getUser();

        // If bank charges do not exist, create a new entry first
        if (!bankChargesId) {
            const { data, error } = await supabase.from('bank_charges').insert({ shipment_id: shipmentId, created_by: user.id }).select().single();
            if (error) {
                showMessage('bank-charges-modal-message', `Error creating bank charges: ${error.message}`, true);
                return;
            }
            bankChargesId = data.id;
            document.getElementById('bank_charges_id').value = bankChargesId;
        }

        const fileName = document.getElementById('new_doc_name').value;
        const fileCategory = document.getElementById('new_doc_category').value;
        const file = document.getElementById('new_doc_file').files[0];

        if (!file) {
            showMessage('bank-charges-modal-message', 'File is required.', true);
            return;
        }

        const { data, error } = await supabase.storage
            .from('shipment-docs')
            .upload(`${shipmentId}/bank_charges/${file.name}`, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            showMessage('bank-charges-modal-message', `Error uploading file: ${error.message}`, true);
            return;
        }

        const { data: publicUrlData } = supabase.storage.from('shipment-docs').getPublicUrl(data.path);

        const docData = {
            bank_charges_id: bankChargesId,
            file_url: publicUrlData.publicUrl,
            file_name: fileName || file.name,
            doc_category: fileCategory,
            uploaded_by: user.id
        };

        const { error: docError } = await supabase.from('bank_charge_documents').insert(docData);

        if (docError) {
            showMessage('bank-charges-modal-message', `Error saving document record: ${docError.message}`, true);
        } else {
            showToast('Document saved successfully!', true);
            cancelAddDocument();
            await openBankChargesModal(); // Refresh the modal
        }
    }

    window.openBankChargesModal = openBankChargesModal;
    window.closeBankChargesModal = closeBankChargesModal;
    window.saveBankCharges = saveBankCharges;
    window.addDocumentForm = addDocumentForm;
    window.cancelAddDocument = cancelAddDocument;
    window.saveBankChargeDocument = saveBankChargeDocument;
    window.renderBankChargesView = renderBankChargesView;
    window.renderBankChargesEdit = renderBankChargesEdit;
    window.cancelBankChargesEdit = cancelBankChargesEdit;

    let insuranceData = {};

    async function openInsuranceModal() {
        const modal = document.getElementById('insurance-modal');
        modal.classList.add('show');
        
        const { data, error } = await supabase
            .from('insurance')
            .select(`
                *,
                insurance_documents (*)
            `)
            .eq('shipment_id', shipmentId)
            .single();

        if (error && error.code !== 'PGRST116') {
            showMessage('insurance-modal-message', `Error loading insurance: ${error.message}`, true);
            return;
        }
        insuranceData = data || {};
        renderInsuranceView();
    }

    function renderInsuranceView() {
        const viewContainer = document.getElementById('insurance-view-container');
        const editContainer = document.getElementById('insurance-edit-container');
        const detailsTable = document.getElementById('insurance-details-table');

        let html = '<div class="form-section"><h3>Insurance Details</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">Value:</span><span class="detail-value">${insuranceData.value || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Rate:</span><span class="detail-value">${insuranceData.rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Amount:</span><span class="detail-value">${insuranceData.amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">10%:</span><span class="detail-value">${insuranceData.ten_perc || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Total Value:</span><span class="detail-value">${insuranceData.total_value || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Marine (%):</span><span class="detail-value">${insuranceData.marine_perc || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Marine Amount:</span><span class="detail-value">${insuranceData.marine_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">War (%):</span><span class="detail-value">${insuranceData.war_perc || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">War Amount:</span><span class="detail-value">${insuranceData.war_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">ASC:</span><span class="detail-value">${insuranceData.asc_1 || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">FIF (%):</span><span class="detail-value">${insuranceData.fif_perc || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">FIF Amount:</span><span class="detail-value">${insuranceData.fif_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">STS (%):</span><span class="detail-value">${insuranceData.sts_perc || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">STS Amount:</span><span class="detail-value">${insuranceData.sts_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Stamp:</span><span class="detail-value">${insuranceData.stamp || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Grand Total:</span><span class="detail-value">${insuranceData.grand_total || 'N/A'}</span></div>`;
        html += '</div></div>';

        if (insuranceData.insurance_documents && insuranceData.insurance_documents.length > 0) {
            html += '<div class="form-section"><h3>Documents</h3><ul>';
            insuranceData.insurance_documents.forEach(doc => {
                html += `<li><a href="${doc.file_url}" target="_blank">${doc.file_name}</a> (${doc.doc_category || 'No Category'})</li>`;
            });
            html += '</ul></div>';
        }

        detailsTable.innerHTML = html;

        viewContainer.style.display = 'block';
        editContainer.style.display = 'none';
    }

    function renderInsuranceEdit() {
        const viewContainer = document.getElementById('insurance-view-container');
        const editContainer = document.getElementById('insurance-edit-container');

        document.getElementById('insurance_id').value = insuranceData.id || '';
        document.getElementById('ins_value').value = insuranceData.value || '';
        document.getElementById('ins_rate').value = insuranceData.rate || '';
        document.getElementById('ins_amount').value = insuranceData.amount || '';
        document.getElementById('ins_ten_perc').value = insuranceData.ten_perc || '';
        document.getElementById('ins_total_value').value = insuranceData.total_value || '';
        document.getElementById('ins_marine_perc').value = insuranceData.marine_perc || '';
        document.getElementById('ins_marine_amount').value = insuranceData.marine_amount || '';
        document.getElementById('ins_war_perc').value = insuranceData.war_perc || '';
        document.getElementById('ins_war_amount').value = insuranceData.war_amount || '';
        document.getElementById('ins_asc_1').value = insuranceData.asc_1 || '';
        document.getElementById('ins_fif_perc').value = insuranceData.fif_perc || '';
        document.getElementById('ins_fif_amount').value = insuranceData.fif_amount || '';
        document.getElementById('ins_sts_perc').value = insuranceData.sts_perc || '';
        document.getElementById('ins_sts_amount').value = insuranceData.sts_amount || '';
        document.getElementById('ins_stamp').value = insuranceData.stamp || '';
        document.getElementById('ins_grand_total').value = insuranceData.grand_total || '';

        const documentsList = document.getElementById('insurance-documents-list');
        documentsList.innerHTML = '';
        if (insuranceData.insurance_documents && insuranceData.insurance_documents.length > 0) {
            let docsHtml = '<h4>Uploaded Documents</h4><ul>';
            insuranceData.insurance_documents.forEach(doc => {
                docsHtml += `<li><a href="${doc.file_url}" target="_blank">${doc.file_name}</a> (${doc.doc_category || 'No Category'})</li>`;
            });
            docsHtml += '</ul>';
            documentsList.innerHTML = docsHtml;
        }

        viewContainer.style.display = 'none';
        editContainer.style.display = 'block';

        // Add event listeners for auto-calculation
        const fieldsToWatch = ['ins_value', 'ins_rate', 'ins_marine_perc', 'ins_war_perc', 'ins_asc_1', 'ins_fif_perc', 'ins_sts_perc', 'ins_stamp'];
        fieldsToWatch.forEach(fieldId => {
            document.getElementById(fieldId).addEventListener('input', calculateInsuranceOnChange);
        });
    }

    function cancelInsuranceEdit() {
        renderInsuranceView();
    }

    function closeInsuranceModal() {
        const modal = document.getElementById('insurance-modal');
        modal.classList.remove('show');
    }

    async function saveInsurance() {
        const insuranceId = document.getElementById('insurance_id').value;
        const { data: { user } } = await supabase.auth.getUser();

        const insuranceDetails = {
            shipment_id: shipmentId,
            value: getNumericValue('ins_value'),
            rate: getNumericValue('ins_rate'),
            amount: getNumericValue('ins_amount'),
            ten_perc: getNumericValue('ins_ten_perc'),
            total_value: getNumericValue('ins_total_value'),
            marine_perc: getNumericValue('ins_marine_perc'),
            marine_amount: getNumericValue('ins_marine_amount'),
            war_perc: getNumericValue('ins_war_perc'),
            war_amount: getNumericValue('ins_war_amount'),
            asc_1: getNumericValue('ins_asc_1'),
            fif_perc: getNumericValue('ins_fif_perc'),
            fif_amount: getNumericValue('ins_fif_amount'),
            sts_perc: getNumericValue('ins_sts_perc'),
            sts_amount: getNumericValue('ins_sts_amount'),
            stamp: getNumericValue('ins_stamp'),
            grand_total: getNumericValue('ins_grand_total'),
            created_by: user.id
        };

        if (insuranceId) {
            const { error } = await supabase.from('insurance').update(insuranceDetails).eq('id', insuranceId);
            if (error) {
                showMessage('insurance-modal-message', `Error updating insurance: ${error.message}`, true);
                return;
            }
        } else {
            const { data, error } = await supabase.from('insurance').insert(insuranceDetails).select().single();
            if (error) {
                showMessage('insurance-modal-message', `Error creating insurance: ${error.message}`, true);
                return;
            }
            document.getElementById('insurance_id').value = data.id;
        }

        showToast('Insurance saved successfully!', true);
        await openInsuranceModal();
    }

    function addInsuranceDocumentForm() {
        const container = document.getElementById('add-insurance-document-form-container');
        const formHtml = `
            <div class="form-grid">
                <div class="form-group">
                    <label for="new_insurance_doc_name">File Name</label>
                    <input type="text" id="new_insurance_doc_name" name="new_insurance_doc_name">
                </div>
                <div class="form-group">
                    <label for="new_insurance_doc_category">File Category</label>
                    <input type="text" id="new_insurance_doc_category" name="new_insurance_doc_category">
                </div>
                <div class="form-group">
                    <label for="new_insurance_doc_file">File</label>
                    <input type="file" id="new_insurance_doc_file" name="new_insurance_doc_file">
                </div>
            </div>
            <button type="button" onclick="saveInsuranceDocument()">Save Document</button>
            <button type="button" class="button-secondary" onclick="cancelAddInsuranceDocument()">Cancel</button>
        `;
        container.innerHTML = formHtml;
    }

    function cancelAddInsuranceDocument() {
        const container = document.getElementById('add-insurance-document-form-container');
        container.innerHTML = '';
    }

    async function saveInsuranceDocument() {
        let insuranceId = document.getElementById('insurance_id').value;
        const { data: { user } } = await supabase.auth.getUser();

        if (!insuranceId) {
            const { data, error } = await supabase.from('insurance').insert({ shipment_id: shipmentId, created_by: user.id }).select().single();
            if (error) {
                showMessage('insurance-modal-message', `Error creating insurance: ${error.message}`, true);
                return;
            }
            insuranceId = data.id;
            document.getElementById('insurance_id').value = insuranceId;
        }

        const fileName = document.getElementById('new_insurance_doc_name').value;
        const fileCategory = document.getElementById('new_insurance_doc_category').value;
        const file = document.getElementById('new_insurance_doc_file').files[0];

        if (!file) {
            showMessage('insurance-modal-message', 'File is required.', true);
            return;
        }

        const { data, error } = await supabase.storage
            .from('shipment-docs')
            .upload(`${shipmentId}/insurance/${file.name}`, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            showMessage('insurance-modal-message', `Error uploading file: ${error.message}`, true);
            return;
        }

        const { data: publicUrlData } = supabase.storage.from('shipment-docs').getPublicUrl(data.path);

        const docData = {
            insurance_id: insuranceId,
            file_url: publicUrlData.publicUrl,
            file_name: fileName || file.name,
            doc_category: fileCategory,
            uploaded_by: user.id
        };

        const { error: docError } = await supabase.from('insurance_documents').insert(docData);

        if (docError) {
            showMessage('insurance-modal-message', `Error saving document record: ${docError.message}`, true);
        } else {
            showToast('Document saved successfully!', true);
            cancelAddInsuranceDocument();
            await openInsuranceModal();
        }
    }

    window.openInsuranceModal = openInsuranceModal;
    window.closeInsuranceModal = closeInsuranceModal;
    window.saveInsurance = saveInsurance;
    window.addInsuranceDocumentForm = addInsuranceDocumentForm;
    window.cancelAddInsuranceDocument = cancelAddInsuranceDocument;
    window.saveInsuranceDocument = saveInsuranceDocument;
    window.renderInsuranceView = renderInsuranceView;
    window.renderInsuranceEdit = renderInsuranceEdit;
    window.cancelInsuranceEdit = cancelInsuranceEdit;

    async function calculateInsuranceOnChange() {
        console.log('calculateInsuranceOnChange triggered');
        const input = {
            value: parseFloat(document.getElementById('ins_value').value) || 0,
            rate: parseFloat(document.getElementById('ins_rate').value) || 0,
            marine_perc: parseFloat(document.getElementById('ins_marine_perc').value) || 0,
            war_perc: parseFloat(document.getElementById('ins_war_perc').value) || 0,
            asc_1: parseFloat(document.getElementById('ins_asc_1').value) || 0,
            fif_perc: parseFloat(document.getElementById('ins_fif_perc').value) || 0,
            sts_perc: parseFloat(document.getElementById('ins_sts_perc').value) || 0,
            stamp: parseFloat(document.getElementById('ins_stamp').value) || 0,
        };
        console.log('Input values:', input);

        const { data, error } = await supabase.functions.invoke('calculate-insurance', {
            body: { input },
        });

        if (error) {
            console.error('Error calculating insurance:', error);
            return;
        }

        console.log('Calculations received:', data);
        const calculations = data.calculations;
        document.getElementById('ins_amount').value = calculations.amount;
        document.getElementById('ins_ten_perc').value = calculations.ten_perc;
        document.getElementById('ins_total_value').value = calculations.total_value;
        document.getElementById('ins_marine_amount').value = calculations.marine_amount;
        document.getElementById('ins_war_amount').value = calculations.war_amount;
        document.getElementById('ins_fif_amount').value = calculations.fif_amount;
        document.getElementById('ins_sts_amount').value = calculations.sts_amount;
        document.getElementById('ins_grand_total').value = calculations.grand_total;
    }

    // Freight Forwarder Modal Functions
    let freightForwarderData = {};

    async function openFreightForwarderModal() {
        const modal = document.getElementById('freight-forwarder-modal');
        modal.classList.add('show');
        
        const { data, error } = await supabase
            .from('freight_forwarder_bill')
            .select(`
                *,
                charges (*)
            `)
            .eq('shipment_id', shipmentId)
            .single();

        if (error && error.code !== 'PGRST116') {
            showMessage('freight-forwarder-modal-message', `Error loading freight forwarder bill: ${error.message}`, true);
            return;
        }
        freightForwarderData = data || {};
        renderFreightForwarderView();
    }

    function renderFreightForwarderView() {
        const viewContainer = document.getElementById('freight-forwarder-view-container');
        const editContainer = document.getElementById('freight-forwarder-edit-container');
        const detailsTable = document.getElementById('freight-forwarder-details-table');

        let html = '<div class="form-section"><h3>Main Details</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">Mode:</span><span class="detail-value">${freightForwarderData.mode || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Agreed Weight (KG):</span><span class="detail-value">${freightForwarderData.agree_weight_kg || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Agreed CBM:</span><span class="detail-value">${freightForwarderData.agree_cbm || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Weight as per PL:</span><span class="detail-value">${freightForwarderData.weight_as_per_pl || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Weight as per BL:</span><span class="detail-value">${freightForwarderData.weight_as_per_bl || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Agreed Rate (USD):</span><span class="detail-value">${freightForwarderData.agreed_rate_usd || 'N/A'}</span></div>`;
        html += '</div></div>';

        // Group charges by type
        const chargesByType = {
            freight_and_exw_charges: [],
            local_charges: [],
            deduction: []
        };

        if (freightForwarderData.charges) {
            freightForwarderData.charges.forEach(charge => {
                if (chargesByType[charge.type]) {
                    chargesByType[charge.type].push(charge);
                }
            });
        }

        // Display Freight & EXW Charges
        html += '<div class="form-section"><h3>Freight & EXW Charges</h3>';
        if (chargesByType.freight_and_exw_charges.length > 0) {
            chargesByType.freight_and_exw_charges.forEach(charge => {
                html += `<div class="detail-item"><span class="detail-label">${charge.name}:</span><span class="detail-value">${charge.description || 'N/A'}</span></div>`;
            });
        } else {
            html += '<p class="no-data">No freight & EXW charges added.</p>';
        }
        html += '</div>';

        // Display Local Charges
        html += '<div class="form-section"><h3>Local Charges</h3>';
        if (chargesByType.local_charges.length > 0) {
            chargesByType.local_charges.forEach(charge => {
                html += `<div class="detail-item"><span class="detail-label">${charge.name}:</span><span class="detail-value">${charge.description || 'N/A'}</span></div>`;
            });
        } else {
            html += '<p class="no-data">No local charges added.</p>';
        }
        html += '</div>';

        // Display Deductions
        html += '<div class="form-section"><h3>Deductions</h3>';
        if (chargesByType.deduction.length > 0) {
            chargesByType.deduction.forEach(charge => {
                html += `<div class="detail-item"><span class="detail-label">${charge.name}:</span><span class="detail-value">${charge.description || 'N/A'}</span></div>`;
            });
        } else {
            html += '<p class="no-data">No deductions added.</p>';
        }
        html += '</div>';

        detailsTable.innerHTML = html;
        
        viewContainer.style.display = 'block';
        editContainer.style.display = 'none';
    }

    function renderFreightForwarderEdit() {
        const viewContainer = document.getElementById('freight-forwarder-view-container');
        const editContainer = document.getElementById('freight-forwarder-edit-container');

        // Populate form with existing data
        if (freightForwarderData.id) {
            document.getElementById('freight_forwarder_bill_id').value = freightForwarderData.id;
        }
        document.getElementById('ff_mode').value = freightForwarderData.mode || '';
        document.getElementById('ff_agree_weight_kg').value = freightForwarderData.agree_weight_kg || '';
        document.getElementById('ff_agree_cbm').value = freightForwarderData.agree_cbm || '';
        document.getElementById('ff_weight_as_per_pl').value = freightForwarderData.weight_as_per_pl || '';
        document.getElementById('ff_weight_as_per_bl').value = freightForwarderData.weight_as_per_bl || '';
        document.getElementById('ff_agreed_rate_usd').value = freightForwarderData.agreed_rate_usd || '';

        // Render existing charges by type
        renderChargesList('freight_and_exw_charges');
        renderChargesList('local_charges');
        renderChargesList('deduction');

        viewContainer.style.display = 'none';
        editContainer.style.display = 'block';
    }

    function renderChargesList(type) {
        const containers = {
            'freight_and_exw_charges': 'freight-exw-charges-list',
            'local_charges': 'local-charges-list',
            'deduction': 'deduction-charges-list'
        };
        
        const container = document.getElementById(containers[type]);
        if (!container) return;

        let html = '';
        if (freightForwarderData.charges) {
            const chargesOfType = freightForwarderData.charges.filter(charge => charge.type === type);
            chargesOfType.forEach(charge => {
                html += `
                <div class="charge-item" data-charge-id="${charge.id}">
                    <div class="charge-item-header">
                        <div class="charge-name">${charge.name || 'Unnamed Charge'}</div>
                        <div class="charge-actions">
                            <button class="edit-btn" onclick="editCharge('${charge.id}')">Edit</button>
                            <button class="delete-btn" onclick="deleteCharge('${charge.id}')">Delete</button>
                        </div>
                    </div>
                    <div class="charge-description">${charge.description || 'No description'}</div>
                </div>`;
            });
        }
        
        if (html === '') {
            html = '<p class="no-data">No charges added yet.</p>';
        }
        
        container.innerHTML = html;
    }

    function cancelFreightForwarderEdit() {
        renderFreightForwarderView();
    }

    function closeFreightForwarderModal() {
        const modal = document.getElementById('freight-forwarder-modal');
        modal.classList.remove('show');
    }

    async function saveFreightForwarderBill() {
        const { data: { user } } = await supabase.auth.getUser();
        
        const freightForwarderBillData = {
            shipment_id: shipmentId,
            mode: document.getElementById('ff_mode').value,
            agree_weight_kg: parseFloat(document.getElementById('ff_agree_weight_kg').value) || null,
            agree_cbm: parseFloat(document.getElementById('ff_agree_cbm').value) || null,
            weight_as_per_pl: parseFloat(document.getElementById('ff_weight_as_per_pl').value) || null,
            weight_as_per_bl: parseFloat(document.getElementById('ff_weight_as_per_bl').value) || null,
            agreed_rate_usd: parseFloat(document.getElementById('ff_agreed_rate_usd').value) || null,
            created_by: user.id
        };

        let freightForwarderBillId = document.getElementById('freight_forwarder_bill_id').value;

        if (freightForwarderBillId) {
            const { error } = await supabase.from('freight_forwarder_bill').update(freightForwarderBillData).eq('id', freightForwarderBillId);
            if (error) {
                showMessage('freight-forwarder-modal-message', `Error updating freight forwarder bill: ${error.message}`, true);
                return;
            }
        } else {
            const { data, error } = await supabase.from('freight_forwarder_bill').insert(freightForwarderBillData).select().single();
            if (error) {
                showMessage('freight-forwarder-modal-message', `Error creating freight forwarder bill: ${error.message}`, true);
                return;
            }
            freightForwarderBillId = data.id;
            document.getElementById('freight_forwarder_bill_id').value = freightForwarderBillId;
        }

        showToast('Freight forwarder bill saved successfully!', true);
        await openFreightForwarderModal();
    }

    function addChargeForm(type) {
        const containers = {
            'freight_and_exw_charges': 'add-freight-exw-form-container',
            'local_charges': 'add-local-charges-form-container',
            'deduction': 'add-deduction-form-container'
        };
        
        const container = document.getElementById(containers[type]);
        if (!container) return;

        const formHtml = `
            <div class="form-grid">
                <div class="form-group">
                    <label for="new_charge_name_${type}">Name</label>
                    <input type="text" id="new_charge_name_${type}" name="new_charge_name_${type}">
                </div>
                <div class="form-group">
                    <label for="new_charge_description_${type}">Description</label>
                    <input type="text" id="new_charge_description_${type}" name="new_charge_description_${type}">
                </div>
            </div>
            <button type="button" onclick="saveCharge('${type}')">Save Charge</button>
            <button type="button" class="button-secondary" onclick="cancelAddCharge('${type}')">Cancel</button>
        `;
        container.innerHTML = formHtml;
    }

    function cancelAddCharge(type) {
        const containers = {
            'freight_and_exw_charges': 'add-freight-exw-form-container',
            'local_charges': 'add-local-charges-form-container',
            'deduction': 'add-deduction-form-container'
        };
        
        const container = document.getElementById(containers[type]);
        if (container) {
            container.innerHTML = '';
        }
    }

    async function saveCharge(type) {
        let freightForwarderBillId = document.getElementById('freight_forwarder_bill_id').value;
        const { data: { user } } = await supabase.auth.getUser();

        if (!freightForwarderBillId) {
            const { data, error } = await supabase.from('freight_forwarder_bill').insert({ 
                shipment_id: shipmentId, 
                created_by: user.id 
            }).select().single();
            if (error) {
                showMessage('freight-forwarder-modal-message', `Error creating freight forwarder bill: ${error.message}`, true);
                return;
            }
            freightForwarderBillId = data.id;
            document.getElementById('freight_forwarder_bill_id').value = freightForwarderBillId;
        }

        const chargeName = document.getElementById(`new_charge_name_${type}`).value;
        const chargeDescription = document.getElementById(`new_charge_description_${type}`).value;

        if (!chargeName.trim()) {
            showMessage('freight-forwarder-modal-message', 'Charge name is required.', true);
            return;
        }

        const chargeData = {
            freight_forwarder_bill_id: freightForwarderBillId,
            type: type,
            name: chargeName,
            description: chargeDescription,
            created_by: user.id
        };

        const { error } = await supabase.from('charges').insert(chargeData);

        if (error) {
            showMessage('freight-forwarder-modal-message', `Error saving charge: ${error.message}`, true);
        } else {
            showToast('Charge saved successfully!', true);
            cancelAddCharge(type);
            await openFreightForwarderModal();
        }
    }

    async function editCharge(chargeId) {
        // Implementation for editing existing charges would go here
        // For now, just show a message
        showToast('Edit charge functionality to be implemented', false);
    }

    async function deleteCharge(chargeId) {
        if (!confirm('Are you sure you want to delete this charge?')) {
            return;
        }

        const { error } = await supabase.from('charges').delete().eq('id', chargeId);

        if (error) {
            showMessage('freight-forwarder-modal-message', `Error deleting charge: ${error.message}`, true);
        } else {
            showToast('Charge deleted successfully!', true);
            await openFreightForwarderModal();
        }
    }

    window.openFreightForwarderModal = openFreightForwarderModal;
    window.closeFreightForwarderModal = closeFreightForwarderModal;
    window.saveFreightForwarderBill = saveFreightForwarderBill;
    window.renderFreightForwarderEdit = renderFreightForwarderEdit;
    window.renderFreightForwarderView = renderFreightForwarderView;
    window.cancelFreightForwarderEdit = cancelFreightForwarderEdit;
    window.addChargeForm = addChargeForm;
    window.cancelAddCharge = cancelAddCharge;
    window.saveCharge = saveCharge;
    window.editCharge = editCharge;
    window.deleteCharge = deleteCharge;

    // FBR Duty Modal Functions
    let fbrDutyData = {};

    async function openFbrDutyModal() {
        const modal = document.getElementById('fbr-duty-modal');
        modal.classList.add('show');
        
        const { data, error } = await supabase
            .from('fbr_duty')
            .select('*')
            .eq('shipment_id', shipmentId)
            .maybeSingle();

        if (error) {
            showMessage('fbr-duty-modal-message', `Error loading FBR duty: ${error.message}`, true);
            return;
        }
        fbrDutyData = data || {};
        renderFbrDutyView();
    }

    function renderFbrDutyView() {
        const viewContainer = document.getElementById('fbr-duty-view-container');
        const editContainer = document.getElementById('fbr-duty-edit-container');
        const detailsTable = document.getElementById('fbr-duty-details-table');

        let html = '<div class="form-section"><h3>Invoice & Insurance Details</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">Invoice Amount:</span><span class="detail-value">${fbrDutyData.invoice_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Insurance Fix:</span><span class="detail-value">${fbrDutyData.insurance_fix || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Insurance Rate:</span><span class="detail-value">${fbrDutyData.insurance_rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Total After Insurance:</span><span class="detail-value">${fbrDutyData.total_after_insurance || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Landing Charges Rate:</span><span class="detail-value">${fbrDutyData.landing_charges_rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Landing Charges Amount:</span><span class="detail-value">${fbrDutyData.landing_charges_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Total Invoice:</span><span class="detail-value">${fbrDutyData.total_invoice || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">USD Rate:</span><span class="detail-value">${fbrDutyData.usd_rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Access Value:</span><span class="detail-value">${fbrDutyData.access_value || 'N/A'}</span></div>`;
        html += '</div></div>';

        html += '<div class="form-section"><h3>Custom Duties</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">Custom Duty Rate:</span><span class="detail-value">${fbrDutyData.custom_duty_rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Custom Duty Amount:</span><span class="detail-value">${fbrDutyData.custom_duty_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Additional Custom Duty Rate:</span><span class="detail-value">${fbrDutyData.additional_custom_duty_rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Additional Custom Duty Amount:</span><span class="detail-value">${fbrDutyData.additional_custom_duty_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Regulatory Duty Rate:</span><span class="detail-value">${fbrDutyData.regulatory_duty_rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Regulatory Duty Amount:</span><span class="detail-value">${fbrDutyData.regulatory_duty_amount || 'N/A'}</span></div>`;
        html += '</div></div>';

        html += '<div class="form-section"><h3>Sales Tax</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">Value for Sales Tax:</span><span class="detail-value">${fbrDutyData.value_for_sales_tax || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Sales Tax Rate:</span><span class="detail-value">${fbrDutyData.sales_tax_rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Sales Tax Amount:</span><span class="detail-value">${fbrDutyData.sales_tax_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Additional Sales Tax Rate:</span><span class="detail-value">${fbrDutyData.additional_sales_tax_rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Additional Sales Tax Amount:</span><span class="detail-value">${fbrDutyData.additional_sales_tax_amount || 'N/A'}</span></div>`;
        html += '</div></div>';

        html += '<div class="form-section"><h3>Income Tax</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">Value for Income Tax:</span><span class="detail-value">${fbrDutyData.value_for_income_tax || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Income Tax Rate:</span><span class="detail-value">${fbrDutyData.income_tax_rate || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Income Tax Amount:</span><span class="detail-value">${fbrDutyData.income_tax_amount || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Custom:</span><span class="detail-value">${fbrDutyData.custom || 'N/A'}</span></div>`;
        html += '</div></div>';

        html += '<div class="form-section"><h3>Summary</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">Total Duties:</span><span class="detail-value"><strong>${fbrDutyData.total_duties || 'N/A'}</strong></span></div>`;
        html += `<div class="detail-item"><span class="detail-label">As Per PSID:</span><span class="detail-value"><strong>${fbrDutyData.as_per_psid || 'N/A'}</strong></span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Difference:</span><span class="detail-value"><strong>${fbrDutyData.difference || 'N/A'}</strong></span></div>`;
        html += '</div></div>';

        detailsTable.innerHTML = html;
        
        viewContainer.style.display = 'block';
        editContainer.style.display = 'none';
    }

    function renderFbrDutyEdit() {
        const viewContainer = document.getElementById('fbr-duty-view-container');
        const editContainer = document.getElementById('fbr-duty-edit-container');

        // Populate form with existing data
        if (fbrDutyData.id) {
            document.getElementById('fbr_duty_id').value = fbrDutyData.id;
        }
        
        // Invoice & Insurance Details
        document.getElementById('fbr_invoice_amount').value = fbrDutyData.invoice_amount || '';
        document.getElementById('fbr_insurance_fix').value = fbrDutyData.insurance_fix || '';
        document.getElementById('fbr_insurance_rate').value = fbrDutyData.insurance_rate || '';
        document.getElementById('fbr_total_after_insurance').value = fbrDutyData.total_after_insurance || '';
        document.getElementById('fbr_landing_charges_rate').value = fbrDutyData.landing_charges_rate || '';
        document.getElementById('fbr_landing_charges_amount').value = fbrDutyData.landing_charges_amount || '';
        document.getElementById('fbr_total_invoice').value = fbrDutyData.total_invoice || '';
        document.getElementById('fbr_usd_rate').value = fbrDutyData.usd_rate || '';
        document.getElementById('fbr_access_value').value = fbrDutyData.access_value || '';

        // Custom Duties
        document.getElementById('fbr_custom_duty_rate').value = fbrDutyData.custom_duty_rate || '';
        document.getElementById('fbr_custom_duty_amount').value = fbrDutyData.custom_duty_amount || '';
        document.getElementById('fbr_additional_custom_duty_rate').value = fbrDutyData.additional_custom_duty_rate || '';
        document.getElementById('fbr_additional_custom_duty_amount').value = fbrDutyData.additional_custom_duty_amount || '';
        document.getElementById('fbr_regulatory_duty_rate').value = fbrDutyData.regulatory_duty_rate || '';
        document.getElementById('fbr_regulatory_duty_amount').value = fbrDutyData.regulatory_duty_amount || '';

        // Sales Tax
        document.getElementById('fbr_value_for_sales_tax').value = fbrDutyData.value_for_sales_tax || '';
        document.getElementById('fbr_sales_tax_rate').value = fbrDutyData.sales_tax_rate || '';
        document.getElementById('fbr_sales_tax_amount').value = fbrDutyData.sales_tax_amount || '';
        document.getElementById('fbr_additional_sales_tax_rate').value = fbrDutyData.additional_sales_tax_rate || '';
        document.getElementById('fbr_additional_sales_tax_amount').value = fbrDutyData.additional_sales_tax_amount || '';

        // Income Tax
        document.getElementById('fbr_value_for_income_tax').value = fbrDutyData.value_for_income_tax || '';
        document.getElementById('fbr_income_tax_rate').value = fbrDutyData.income_tax_rate || '';
        document.getElementById('fbr_income_tax_amount').value = fbrDutyData.income_tax_amount || '';
        document.getElementById('fbr_custom').value = fbrDutyData.custom || '';

        // Additional Charges
        document.getElementById('fbr_excise_on_a_value_rate').value = fbrDutyData.excise_on_a_value_rate || '';
        document.getElementById('fbr_excise_on_a_value_amount').value = fbrDutyData.excise_on_a_value_amount || '';
        document.getElementById('fbr_l_single_declaration_rate').value = fbrDutyData.l_single_declaration_rate || '';
        document.getElementById('fbr_l_single_declaration_amount').value = fbrDutyData.l_single_declaration_amount || '';
        document.getElementById('fbr_m_release_order_rate').value = fbrDutyData.m_release_order_rate || '';
        document.getElementById('fbr_m_release_order_amount').value = fbrDutyData.m_release_order_amount || '';
        document.getElementById('fbr_n_stamp_duty_rate').value = fbrDutyData.n_stamp_duty_rate || '';
        document.getElementById('fbr_n_stamp_duty_amount').value = fbrDutyData.n_stamp_duty_amount || '';

        // Summary
        document.getElementById('fbr_total_duties').value = fbrDutyData.total_duties || '';
        document.getElementById('fbr_as_per_psid').value = fbrDutyData.as_per_psid || '';
        document.getElementById('fbr_difference').value = fbrDutyData.difference || '';

        viewContainer.style.display = 'none';
        editContainer.style.display = 'block';
    }

    function cancelFbrDutyEdit() {
        renderFbrDutyView();
    }

    function closeFbrDutyModal() {
        const modal = document.getElementById('fbr-duty-modal');
        modal.classList.remove('show');
    }

    async function saveFbrDuty() {
        const { data: { user } } = await supabase.auth.getUser();
        
        const fbrDutyFormData = {
            shipment_id: shipmentId,
            invoice_amount: parseFloat(document.getElementById('fbr_invoice_amount').value) || null,
            insurance_fix: parseFloat(document.getElementById('fbr_insurance_fix').value) || null,
            insurance_rate: parseFloat(document.getElementById('fbr_insurance_rate').value) || null,
            total_after_insurance: parseFloat(document.getElementById('fbr_total_after_insurance').value) || null,
            landing_charges_rate: parseFloat(document.getElementById('fbr_landing_charges_rate').value) || null,
            landing_charges_amount: parseFloat(document.getElementById('fbr_landing_charges_amount').value) || null,
            total_invoice: parseFloat(document.getElementById('fbr_total_invoice').value) || null,
            usd_rate: parseFloat(document.getElementById('fbr_usd_rate').value) || null,
            access_value: parseFloat(document.getElementById('fbr_access_value').value) || null,
            custom_duty_rate: parseFloat(document.getElementById('fbr_custom_duty_rate').value) || null,
            custom_duty_amount: parseFloat(document.getElementById('fbr_custom_duty_amount').value) || null,
            additional_custom_duty_rate: parseFloat(document.getElementById('fbr_additional_custom_duty_rate').value) || null,
            additional_custom_duty_amount: parseFloat(document.getElementById('fbr_additional_custom_duty_amount').value) || null,
            regulatory_duty_rate: parseFloat(document.getElementById('fbr_regulatory_duty_rate').value) || null,
            regulatory_duty_amount: parseFloat(document.getElementById('fbr_regulatory_duty_amount').value) || null,
            value_for_sales_tax: parseFloat(document.getElementById('fbr_value_for_sales_tax').value) || null,
            sales_tax_rate: parseFloat(document.getElementById('fbr_sales_tax_rate').value) || null,
            sales_tax_amount: parseFloat(document.getElementById('fbr_sales_tax_amount').value) || null,
            additional_sales_tax_rate: parseFloat(document.getElementById('fbr_additional_sales_tax_rate').value) || null,
            additional_sales_tax_amount: parseFloat(document.getElementById('fbr_additional_sales_tax_amount').value) || null,
            value_for_income_tax: parseFloat(document.getElementById('fbr_value_for_income_tax').value) || null,
            income_tax_rate: parseFloat(document.getElementById('fbr_income_tax_rate').value) || null,
            income_tax_amount: parseFloat(document.getElementById('fbr_income_tax_amount').value) || null,
            custom: parseFloat(document.getElementById('fbr_custom').value) || null,
            excise_on_a_value_rate: parseFloat(document.getElementById('fbr_excise_on_a_value_rate').value) || null,
            excise_on_a_value_amount: parseFloat(document.getElementById('fbr_excise_on_a_value_amount').value) || null,
            l_single_declaration_amount: parseFloat(document.getElementById('fbr_l_single_declaration_amount').value) || null,
            m_release_order_amount: parseFloat(document.getElementById('fbr_m_release_order_amount').value) || null,
            n_stamp_duty_amount: parseFloat(document.getElementById('fbr_n_stamp_duty_amount').value) || null,
            total_duties: parseFloat(document.getElementById('fbr_total_duties').value) || null,
            as_per_psid: parseFloat(document.getElementById('fbr_as_per_psid').value) || null,
            difference: parseFloat(document.getElementById('fbr_difference').value) || null,
            created_by: user.id
        };

        const { error } = await supabase.from('fbr_duty').upsert(fbrDutyFormData, { onConflict: 'shipment_id' });

        if (error) {
            showMessage('fbr-duty-modal-message', `Error saving FBR duty: ${error.message}`, true);
            return;
        }

        showToast('FBR duty saved successfully!', true);
        await openFbrDutyModal();
    }

    window.openFbrDutyModal = openFbrDutyModal;
    window.closeFbrDutyModal = closeFbrDutyModal;
    window.saveFbrDuty = saveFbrDuty;
    window.renderFbrDutyEdit = renderFbrDutyEdit;
    window.renderFbrDutyView = renderFbrDutyView;
    window.cancelFbrDutyEdit = cancelFbrDutyEdit;

    async function calculateFbrDutyOnChange() {
        console.log('calculateFbrDutyOnChange triggered');
        const input = {
            invoice_amount: parseFloat(document.getElementById('fbr_invoice_amount').value) || 0,
            insurance_fix: parseFloat(document.getElementById('fbr_insurance_fix').value) || 0,
            landing_charges_rate: parseFloat(document.getElementById('fbr_landing_charges_rate').value) || 0,
            usd_rate: parseFloat(document.getElementById('fbr_usd_rate').value) || 0,
            custom_duty_rate: parseFloat(document.getElementById('fbr_custom_duty_rate').value) || 0,
            additional_custom_duty_rate: parseFloat(document.getElementById('fbr_additional_custom_duty_rate').value) || 0,
            regulatory_duty_rate: parseFloat(document.getElementById('fbr_regulatory_duty_rate').value) || 0,
            sales_tax_rate: parseFloat(document.getElementById('fbr_sales_tax_rate').value) || 0,
            additional_sales_tax_rate: parseFloat(document.getElementById('fbr_additional_sales_tax_rate').value) || 0,
            income_tax_rate: parseFloat(document.getElementById('fbr_income_tax_rate').value) || 0,
            excise_on_a_value_rate: parseFloat(document.getElementById('fbr_excise_on_a_value_rate').value) || 0,
            l_single_declaration_amount: parseFloat(document.getElementById('fbr_l_single_declaration_amount').value) || 0,
            m_release_order_amount: parseFloat(document.getElementById('fbr_m_release_order_amount').value) || 0,
            n_stamp_duty_amount: parseFloat(document.getElementById('fbr_n_stamp_duty_amount').value) || 0,
            as_per_psid: parseFloat(document.getElementById('fbr_as_per_psid').value) || 0,
        };
        console.log('Input values for FBR Duty:', input);

        const { data, error } = await supabase.functions.invoke('calculate-fbr-duty', {
            body: { input },
        });

        if (error) {
            console.error('Error calculating FBR duty:', error);
            return;
        }

        console.log('FBR Duty calculations received:', data);
        const calcs = data.calculations;
        document.getElementById('fbr_total_after_insurance').value = calcs.total_after_insurance;
        document.getElementById('fbr_landing_charges_amount').value = calcs.landing_charges_amount;
        document.getElementById('fbr_total_invoice').value = calcs.total_invoice;
        document.getElementById('fbr_access_value').value = calcs.access_value;
        document.getElementById('fbr_custom_duty_amount').value = calcs.custom_duty_amount;
        document.getElementById('fbr_additional_custom_duty_amount').value = calcs.additional_custom_duty_amount;
        document.getElementById('fbr_regulatory_duty_amount').value = calcs.regulatory_duty_amount;
        document.getElementById('fbr_value_for_sales_tax').value = calcs.value_for_sales_tax;
        document.getElementById('fbr_sales_tax_amount').value = calcs.sales_tax_amount;
        document.getElementById('fbr_additional_sales_tax_amount').value = calcs.additional_sales_tax_amount;
        document.getElementById('fbr_value_for_income_tax').value = calcs.value_for_income_tax;
        document.getElementById('fbr_income_tax_amount').value = calcs.income_tax_amount;
        document.getElementById('fbr_custom').value = calcs.custom;
        document.getElementById('fbr_excise_on_a_value_amount').value = calcs.excise_on_a_value_amount;
        document.getElementById('fbr_total_duties').value = calcs.total_duties;
        document.getElementById('fbr_difference').value = calcs.difference;
    }

    // ===== BILITY MODAL FUNCTIONS =====
    async function openBilityModal() {
        const modal = document.getElementById('bility-modal');
        modal.classList.add('show');
        await loadBilityData();
        renderBilityView();
    }

    async function loadBilityData() {
        try {
            const { data, error } = await supabase
                .from('bility')
                .select('*')
                .eq('shipment_id', shipmentId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading bility data:', error);
                return;
            }

            currentStageData.bilityDetails = data;
        } catch (err) {
            console.error('Error loading bility data:', err);
        }
    }

    function renderBilityView() {
        const viewContainer = document.getElementById('bility-view-container');
        const editContainer = document.getElementById('bility-edit-container');
        const detailsTable = document.getElementById('bility-details-table');
        
        const data = currentStageData.bilityDetails;
        
        if (data) {
            detailsTable.innerHTML = `
                <h4>Bility Details</h4>
                <div class="details-grid">
                    <div class="detail-group">
                        <h5>Basic Information</h5>
                        <div class="detail-item"><span class="label">Cargo Name:</span> <span class="value">${data.cargo_name || 'N/A'}</span></div>
                    </div>
                    <div class="detail-group">
                        <h5>Bility Numbers</h5>
                        <div class="detail-item"><span class="label">As per HS:</span> <span class="value">${data.bility_number_as_per_hs || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">As per Cargo:</span> <span class="value">${data.bility_number_as_per_cargo || 'N/A'}</span></div>
                    </div>
                    <div class="detail-group">
                        <h5>Delivery Route</h5>
                        <div class="detail-item"><span class="label">As per HS:</span> <span class="value">${data.delivery_route_as_per_hs || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">As per Cargo:</span> <span class="value">${data.delivery_route_as_per_cargo || 'N/A'}</span></div>
                    </div>
                    <div class="detail-group">
                        <h5>Weight & Quantities</h5>
                        <div class="detail-item"><span class="label">Cartoons (HS):</span> <span class="value">${data.no_of_cartoons_as_per_hs || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">Cartoons (Cargo):</span> <span class="value">${data.no_of_cartoons_as_per_cargo || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">Weight (HS):</span> <span class="value">${data.weight_as_per_hs || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">Weight (Cargo):</span> <span class="value">${data.weight_as_per_cargo || 'N/A'}</span></div>
                    </div>
                    <div class="detail-group">
                        <h5>Rates</h5>
                        <div class="detail-item"><span class="label">Rate per KG (HS):</span> <span class="value">${data.rate_per_kg_as_per_hs || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">Rate per KG (Cargo):</span> <span class="value">${data.rate_per_kg_as_per_cargo || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">Rate per CTN (HS):</span> <span class="value">${data.rate_per_ctn_as_per_hs || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">Rate per CTN (Cargo):</span> <span class="value">${data.rate_per_ctn_as_per_cargo || 'N/A'}</span></div>
                    </div>
                    <div class="detail-group">
                        <h5>Financial Summary</h5>
                        <div class="detail-item"><span class="label">Total Freight (HS):</span> <span class="value">${data.total_freight_as_per_hs || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">Total Freight (Cargo):</span> <span class="value">${data.total_freight_as_per_cargo || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">Net Payable (HS):</span> <span class="value">${data.net_payable_amount_as_per_hs || 'N/A'}</span></div>
                        <div class="detail-item"><span class="label">Net Payable (Cargo):</span> <span class="value">${data.net_payable_amount_as_per_cargo || 'N/A'}</span></div>
                    </div>
                </div>
            `;
        } else {
            detailsTable.innerHTML = '<p>No bility data available. Click Edit to add information.</p>';
        }

        viewContainer.style.display = 'block';
        editContainer.style.display = 'none';
    }

    function renderBilityEdit() {
        const viewContainer = document.getElementById('bility-view-container');
        const editContainer = document.getElementById('bility-edit-container');
        const form = document.getElementById('bility-form');
        
        const data = currentStageData.bilityDetails;

        if (data) {
            // Populate form fields with existing data
            document.getElementById('bility_id').value = data.id || '';
            document.getElementById('bility_cargo_name').value = data.cargo_name || '';
            document.getElementById('bility_number_as_per_hs').value = data.bility_number_as_per_hs || '';
            document.getElementById('bility_number_as_per_cargo').value = data.bility_number_as_per_cargo || '';
            document.getElementById('delivery_route_as_per_hs').value = data.delivery_route_as_per_hs || '';
            document.getElementById('delivery_route_as_per_cargo').value = data.delivery_route_as_per_cargo || '';
            document.getElementById('no_of_cartoons_as_per_hs').value = data.no_of_cartoons_as_per_hs || '';
            document.getElementById('no_of_cartoons_as_per_cargo').value = data.no_of_cartoons_as_per_cargo || '';
            document.getElementById('weight_as_per_hs').value = data.weight_as_per_hs || '';
            document.getElementById('weight_as_per_cargo').value = data.weight_as_per_cargo || '';
            document.getElementById('rate_per_kg_as_per_hs').value = data.rate_per_kg_as_per_hs || '';
            document.getElementById('rate_per_kg_as_per_cargo').value = data.rate_per_kg_as_per_cargo || '';
            document.getElementById('total_freight_as_per_hs').value = data.total_freight_as_per_hs || '';
            document.getElementById('total_freight_as_per_cargo').value = data.total_freight_as_per_cargo || '';
            document.getElementById('local_labor_as_per_hs').value = data.local_labor_as_per_hs || '';
            document.getElementById('local_labor_as_per_cargo').value = data.local_labor_as_per_cargo || '';
            document.getElementById('basic_total_as_per_hs').value = data.basic_total_as_per_hs || '';
            document.getElementById('basic_total_as_per_cargo').value = data.basic_total_as_per_cargo || '';
            document.getElementById('destination_labor_as_per_hs').value = data.destination_labor_as_per_hs || '';
            document.getElementById('destination_labor_as_per_cargo').value = data.destination_labor_as_per_cargo || '';
            document.getElementById('destination_to_farm_as_per_hs').value = data.destination_to_farm_as_per_hs || '';
            document.getElementById('destination_to_farm_as_per_cargo').value = data.destination_to_farm_as_per_cargo || '';
            document.getElementById('total_as_per_hs').value = data.total_as_per_hs || '';
            document.getElementById('total_as_per_cargo').value = data.total_as_per_cargo || '';
            document.getElementById('tax_perc_as_per_hs').value = data.tax_perc_as_per_hs || '';
            document.getElementById('tax_perc_as_per_cargo').value = data.tax_perc_as_per_cargo || '';
            document.getElementById('net_payable_amount_as_per_hs').value = data.net_payable_amount_as_per_hs || '';
            document.getElementById('net_payable_amount_as_per_cargo').value = data.net_payable_amount_as_per_cargo || '';
            document.getElementById('rate_per_ctn_as_per_hs').value = data.rate_per_ctn_as_per_hs || '';
            document.getElementById('rate_per_ctn_as_per_cargo').value = data.rate_per_ctn_as_per_cargo || '';
        }

        viewContainer.style.display = 'none';
        editContainer.style.display = 'block';
    }

    async function saveBility() {
        const messageDiv = document.getElementById('bility-modal-message');
        const form = document.getElementById('bility-form');
        const formData = new FormData(form);

        const bilityData = {
            shipment_id: shipmentId,
            cargo_name: formData.get('bility_cargo_name'),
            bility_number_as_per_hs: formData.get('bility_number_as_per_hs') ? parseFloat(formData.get('bility_number_as_per_hs')) : null,
            bility_number_as_per_cargo: formData.get('bility_number_as_per_cargo') ? parseFloat(formData.get('bility_number_as_per_cargo')) : null,
            delivery_route_as_per_hs: formData.get('delivery_route_as_per_hs'),
            delivery_route_as_per_cargo: formData.get('delivery_route_as_per_cargo'),
            no_of_cartoons_as_per_hs: formData.get('no_of_cartoons_as_per_hs') ? parseFloat(formData.get('no_of_cartoons_as_per_hs')) : null,
            no_of_cartoons_as_per_cargo: formData.get('no_of_cartoons_as_per_cargo') ? parseFloat(formData.get('no_of_cartoons_as_per_cargo')) : null,
            weight_as_per_hs: formData.get('weight_as_per_hs') ? parseFloat(formData.get('weight_as_per_hs')) : null,
            weight_as_per_cargo: formData.get('weight_as_per_cargo') ? parseFloat(formData.get('weight_as_per_cargo')) : null,
            rate_per_kg_as_per_hs: formData.get('rate_per_kg_as_per_hs') ? parseFloat(formData.get('rate_per_kg_as_per_hs')) : null,
            rate_per_kg_as_per_cargo: formData.get('rate_per_kg_as_per_cargo') ? parseFloat(formData.get('rate_per_kg_as_per_cargo')) : null,
            total_freight_as_per_hs: formData.get('total_freight_as_per_hs') ? parseFloat(formData.get('total_freight_as_per_hs')) : null,
            total_freight_as_per_cargo: formData.get('total_freight_as_per_cargo') ? parseFloat(formData.get('total_freight_as_per_cargo')) : null,
            local_labor_as_per_hs: formData.get('local_labor_as_per_hs') ? parseFloat(formData.get('local_labor_as_per_hs')) : null,
            local_labor_as_per_cargo: formData.get('local_labor_as_per_cargo') ? parseFloat(formData.get('local_labor_as_per_cargo')) : null,
            basic_total_as_per_hs: formData.get('basic_total_as_per_hs') ? parseFloat(formData.get('basic_total_as_per_hs')) : null,
            basic_total_as_per_cargo: formData.get('basic_total_as_per_cargo') ? parseFloat(formData.get('basic_total_as_per_cargo')) : null,
            destination_labor_as_per_hs: formData.get('destination_labor_as_per_hs') ? parseFloat(formData.get('destination_labor_as_per_hs')) : null,
            destination_labor_as_per_cargo: formData.get('destination_labor_as_per_cargo') ? parseFloat(formData.get('destination_labor_as_per_cargo')) : null,
            destination_to_farm_as_per_hs: formData.get('destination_to_farm_as_per_hs') ? parseFloat(formData.get('destination_to_farm_as_per_hs')) : null,
            destination_to_farm_as_per_cargo: formData.get('destination_to_farm_as_per_cargo') ? parseFloat(formData.get('destination_to_farm_as_per_cargo')) : null,
            total_as_per_hs: formData.get('total_as_per_hs') ? parseFloat(formData.get('total_as_per_hs')) : null,
            total_as_per_cargo: formData.get('total_as_per_cargo') ? parseFloat(formData.get('total_as_per_cargo')) : null,
            tax_perc_as_per_hs: formData.get('tax_perc_as_per_hs') ? parseFloat(formData.get('tax_perc_as_per_hs')) : null,
            tax_perc_as_per_cargo: formData.get('tax_perc_as_per_cargo') ? parseFloat(formData.get('tax_perc_as_per_cargo')) : null,
            net_payable_amount_as_per_hs: formData.get('net_payable_amount_as_per_hs') ? parseFloat(formData.get('net_payable_amount_as_per_hs')) : null,
            net_payable_amount_as_per_cargo: formData.get('net_payable_amount_as_per_cargo') ? parseFloat(formData.get('net_payable_amount_as_per_cargo')) : null,
            rate_per_ctn_as_per_hs: formData.get('rate_per_ctn_as_per_hs') ? parseFloat(formData.get('rate_per_ctn_as_per_hs')) : null,
            rate_per_ctn_as_per_cargo: formData.get('rate_per_ctn_as_per_cargo') ? parseFloat(formData.get('rate_per_ctn_as_per_cargo')) : null
        };

        try {
            const bilityId = formData.get('bility_id');
            let result;

            if (bilityId) {
                // Update existing record
                result = await supabase
                    .from('bility')
                    .update(bilityData)
                    .eq('id', bilityId);
            } else {
                // Insert new record
                result = await supabase
                    .from('bility')
                    .insert([bilityData]);
            }

            if (result.error) {
                messageDiv.innerHTML = '<div class="error-message">Error saving bility: ' + result.error.message + '</div>';
                return;
            }

            messageDiv.innerHTML = '<div class="success-message">Bility saved successfully!</div>';
            await loadBilityData();
            renderBilityView();
            
            setTimeout(() => {
                messageDiv.innerHTML = '';
            }, 3000);

        } catch (err) {
            console.error('Error saving bility:', err);
            messageDiv.innerHTML = '<div class="error-message">Error saving bility data</div>';
        }
    }

    function cancelBilityEdit() {
        renderBilityView();
    }

    function closeBilityModal() {
        const modal = document.getElementById('bility-modal');
        modal.classList.remove('show');
    }

    // Make bility functions globally available
    window.openBilityModal = openBilityModal;
    window.closeBilityModal = closeBilityModal;
    window.saveBility = saveBility;
    window.renderBilityEdit = renderBilityEdit;
    window.renderBilityView = renderBilityView;
    window.cancelBilityEdit = cancelBilityEdit;

    // ===== CLEARING AGENT BILL MODAL FUNCTIONS =====
    let clearingAgentBillData = {};

    async function openClearingAgentBillModal() {
        const modal = document.getElementById('clearing-agent-bill-modal');
        modal.classList.add('show');
        
        const { data, error } = await supabase
            .from('clearing_agent_bill')
            .select(`
                *,
                agency_charges (*),
                receipted_port_expense (*),
                payments (*),
                duties (*)
            `)
            .eq('shipment_id', shipmentId)
            .single();

        if (error && error.code !== 'PGRST116') {
            showMessage('clearing-agent-bill-modal-message', `Error loading clearing agent bill: ${error.message}`, true);
            return;
        }
        clearingAgentBillData = data || {};
        renderClearingAgentBillView();
    }

    function renderClearingAgentBillView() {
        const viewContainer = document.getElementById('clearing-agent-bill-view-container');
        const editContainer = document.getElementById('clearing-agent-bill-edit-container');
        const detailsTable = document.getElementById('clearing-agent-bill-details-table');

        let html = '<div class="form-section"><h3>Bill Information</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">Bill Number:</span><span class="detail-value">${clearingAgentBillData.bill_no || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Invoice Number:</span><span class="detail-value">${clearingAgentBillData.invoice_no || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Total Clearing Agent Value:</span><span class="detail-value">${clearingAgentBillData.total_clearing_agent_value || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Total Clearing Agent Accessed %:</span><span class="detail-value">${clearingAgentBillData.total_clearing_agent_accessed_perc || 'N/A'}</span></div>`;
        html += '</div></div>';

        html += '<div class="form-section"><h3>Expense & Bill Details</h3><div class="form-grid">';
        html += `<div class="detail-item"><span class="detail-label">Total Expense Shipment Value:</span><span class="detail-value">${clearingAgentBillData.total_expense_shipment_value || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Total Expense Shipment Accessed %:</span><span class="detail-value">${clearingAgentBillData.total_expense_shipment_accessed_perc || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Total Bill:</span><span class="detail-value">${clearingAgentBillData.total_bill || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Duties:</span><span class="detail-value">${clearingAgentBillData.duties || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Excise:</span><span class="detail-value">${clearingAgentBillData.excise || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Advance Payments:</span><span class="detail-value">${clearingAgentBillData.advance_payments || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Deduction:</span><span class="detail-value">${clearingAgentBillData.deduction || 'N/A'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-label">Net Payable:</span><span class="detail-value">${clearingAgentBillData.net_payable || 'N/A'}</span></div>`;
        html += '</div></div>';

        // Display Agency Charges (One-to-One)
        html += '<div class="form-section"><h3>Agency Charges</h3>';
        if (clearingAgentBillData.agency_charges && clearingAgentBillData.agency_charges.length > 0) {
            const charge = clearingAgentBillData.agency_charges[0];
            html += `<div class="detail-item"><span class="detail-label">WEBOC Token Value:</span><span class="detail-value">${charge.weboc_token_value || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Transport Charges Value:</span><span class="detail-value">${charge.transport_charges_value || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Sales Tax Value:</span><span class="detail-value">${charge.sales_tax_value || 'N/A'}</span></div>`;
        } else {
            html += '<p class="no-data">No agency charges data.</p>';
        }
        html += '</div>';

        // Display Receipted Port Expenses (One-to-One)
        html += '<div class="form-section"><h3>Receipted Port Expenses</h3>';
        if (clearingAgentBillData.receipted_port_expense && clearingAgentBillData.receipted_port_expense.length > 0) {
            const expense = clearingAgentBillData.receipted_port_expense[0];
            html += `<div class="detail-item"><span class="detail-label">Detention Value:</span><span class="detail-value">${expense.detention_value || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Demmurage Value:</span><span class="detail-value">${expense.demmurage_value || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Handling Charges Value:</span><span class="detail-value">${expense.handling_charges_value || 'N/A'}</span></div>`;
        } else {
            html += '<p class="no-data">No receipted port expenses data.</p>';
        }
        html += '</div>';

        // Display Payments (One-to-One)
        html += '<div class="form-section"><h3>Payments</h3>';
        if (clearingAgentBillData.payments && clearingAgentBillData.payments.length > 0) {
            const payment = clearingAgentBillData.payments[0];
            html += `<div class="detail-item"><span class="detail-label">CD Value:</span><span class="detail-value">${payment.cd_value || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">PRA or ECS Value:</span><span class="detail-value">${payment.pra_or_ecs_value || 'N/A'}</span></div>`;
        } else {
            html += '<p class="no-data">No payments data.</p>';
        }
        html += '</div>';

        // Display Duties (One-to-One)
        html += '<div class="form-section"><h3>Duties</h3>';
        if (clearingAgentBillData.duties && clearingAgentBillData.duties.length > 0) {
            const duty = clearingAgentBillData.duties[0];
            html += `<div class="detail-item"><span class="detail-label">Custom Duty Value:</span><span class="detail-value">${duty.custom_duty_value || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">ACD Value:</span><span class="detail-value">${duty.acd_value || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Sales Tax Value:</span><span class="detail-value">${duty.sales_tax_value || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Income Tax Value:</span><span class="detail-value">${duty.income_tax_value || 'N/A'}</span></div>`;
            html += `<div class="detail-item"><span class="detail-label">Excise Duty Value:</span><span class="detail-value">${duty.excise_duty_value || 'N/A'}</span></div>`;
        } else {
            html += '<p class="no-data">No duties data.</p>';
        }
        html += '</div>';

        detailsTable.innerHTML = html;
        
        viewContainer.style.display = 'block';
        editContainer.style.display = 'none';
    }

    function renderClearingAgentBillEdit() {
        const viewContainer = document.getElementById('clearing-agent-bill-view-container');
        const editContainer = document.getElementById('clearing-agent-bill-edit-container');

        // Populate form with existing data
        if (clearingAgentBillData.id) {
            document.getElementById('clearing_agent_bill_id').value = clearingAgentBillData.id;
        }
        document.getElementById('cab_bill_no').value = clearingAgentBillData.bill_no || '';
        document.getElementById('cab_invoice_no').value = clearingAgentBillData.invoice_no || '';
        document.getElementById('cab_total_clearing_agent_value').value = clearingAgentBillData.total_clearing_agent_value || '';
        document.getElementById('cab_total_clearing_agent_accessed_perc').value = clearingAgentBillData.total_clearing_agent_accessed_perc || '';
        document.getElementById('cab_total_expense_shipment_value').value = clearingAgentBillData.total_expense_shipment_value || '';
        document.getElementById('cab_total_expense_shipment_accessed_perc').value = clearingAgentBillData.total_expense_shipment_accessed_perc || '';
        document.getElementById('cab_total_bill').value = clearingAgentBillData.total_bill || '';
        document.getElementById('cab_duties').value = clearingAgentBillData.duties || '';
        document.getElementById('cab_excise').value = clearingAgentBillData.excise || '';
        document.getElementById('cab_advance_payments').value = clearingAgentBillData.advance_payments || '';
        document.getElementById('cab_deduction').value = clearingAgentBillData.deduction || '';
        document.getElementById('cab_net_payable').value = clearingAgentBillData.net_payable || '';

        // Render child table forms (one-to-one relationships)
        renderAgencyChargesForm();
        renderReceiptedPortExpenseForm();
        renderPaymentsForm();
        renderDutiesForm();

        viewContainer.style.display = 'none';
        editContainer.style.display = 'block';
    }

    function renderAgencyChargesForm() {
        const container = document.getElementById('agency-charges-form');
        if (!container) return;

        const data = clearingAgentBillData.agency_charges && clearingAgentBillData.agency_charges.length > 0 
            ? clearingAgentBillData.agency_charges[0] : {};

        const formHtml = `
            <input type="hidden" id="agency_charges_id" value="${data.id || ''}">
            <div class="form-grid">
                <div class="form-group">
                    <label for="agency_weboc_token_value">WEBOC Token Value</label>
                    <input type="number" step="0.01" id="agency_weboc_token_value" value="${data.weboc_token_value || ''}">
                </div>
                <div class="form-group">
                    <label for="agency_weboc_token_accessed_perc">WEBOC Token Accessed %</label>
                    <input type="number" step="0.01" id="agency_weboc_token_accessed_perc" value="${data.weboc_token_accessed_perc || ''}">
                </div>
                <div class="form-group">
                    <label for="agency_transport_charges_value">Transport Charges Value</label>
                    <input type="number" step="0.01" id="agency_transport_charges_value" value="${data.transport_charges_value || ''}">
                </div>
                <div class="form-group">
                    <label for="agency_transport_charges_accessed_perc">Transport Charges Accessed %</label>
                    <input type="number" step="0.01" id="agency_transport_charges_accessed_perc" value="${data.transport_charges_accessed_perc || ''}">
                </div>
                <div class="form-group">
                    <label for="agency_sales_tax_value">Sales Tax Value</label>
                    <input type="number" step="0.01" id="agency_sales_tax_value" value="${data.sales_tax_value || ''}">
                </div>
                <div class="form-group">
                    <label for="agency_sales_tax_accessed_perc">Sales Tax Accessed %</label>
                    <input type="number" step="0.01" id="agency_sales_tax_accessed_perc" value="${data.sales_tax_accessed_perc || ''}">
                </div>
            </div>
        `;
        container.innerHTML = formHtml;
    }

    function renderReceiptedPortExpenseForm() {
        const container = document.getElementById('receipted-port-expense-form');
        if (!container) return;

        const data = clearingAgentBillData.receipted_port_expense && clearingAgentBillData.receipted_port_expense.length > 0 
            ? clearingAgentBillData.receipted_port_expense[0] : {};

        const formHtml = `
            <input type="hidden" id="receipted_port_expense_id" value="${data.id || ''}">
            <div class="form-grid">
                <div class="form-group">
                    <label for="rpe_detention_value">Detention Value</label>
                    <input type="number" step="0.01" id="rpe_detention_value" value="${data.detention_value || ''}">
                </div>
                <div class="form-group">
                    <label for="rpe_detention_accessed_perc">Detention Accessed %</label>
                    <input type="number" step="0.01" id="rpe_detention_accessed_perc" value="${data.detention_accessed_perc || ''}">
                </div>
                <div class="form-group">
                    <label for="rpe_demmurage_value">Demmurage Value</label>
                    <input type="number" step="0.01" id="rpe_demmurage_value" value="${data.demmurage_value || ''}">
                </div>
                <div class="form-group">
                    <label for="rpe_demmurage_accessed_perc">Demmurage Accessed %</label>
                    <input type="number" step="0.01" id="rpe_demmurage_accessed_perc" value="${data.demmurage_accessed_perc || ''}">
                </div>
                <div class="form-group">
                    <label for="rpe_handling_charges_value">Handling Charges Value</label>
                    <input type="number" step="0.01" id="rpe_handling_charges_value" value="${data.handling_charges_value || ''}">
                </div>
                <div class="form-group">
                    <label for="rpe_handling_charges_accessed_perc">Handling Charges Accessed %</label>
                    <input type="number" step="0.01" id="rpe_handling_charges_accessed_perc" value="${data.handling_charges_accessed_perc || ''}">
                </div>
            </div>
        `;
        container.innerHTML = formHtml;
    }

    function renderPaymentsForm() {
        const container = document.getElementById('payments-form');
        if (!container) return;

        const data = clearingAgentBillData.payments && clearingAgentBillData.payments.length > 0 
            ? clearingAgentBillData.payments[0] : {};

        const formHtml = `
            <input type="hidden" id="payments_id" value="${data.id || ''}">
            <div class="form-grid">
                <div class="form-group">
                    <label for="payment_cd_value">CD Value</label>
                    <input type="number" step="0.01" id="payment_cd_value" value="${data.cd_value || ''}">
                </div>
                <div class="form-group">
                    <label for="payment_cd_accessed_perc">CD Accessed %</label>
                    <input type="number" step="0.01" id="payment_cd_accessed_perc" value="${data.cd_accessed_perc || ''}">
                </div>
                <div class="form-group">
                    <label for="payment_pra_or_ecs_value">PRA or ECS Value</label>
                    <input type="number" step="0.01" id="payment_pra_or_ecs_value" value="${data.pra_or_ecs_value || ''}">
                </div>
                <div class="form-group">
                    <label for="payment_pra_or_ecs_accessed_perc">PRA or ECS Accessed %</label>
                    <input type="number" step="0.01" id="payment_pra_or_ecs_accessed_perc" value="${data.pra_or_ecs_accessed_perc || ''}">
                </div>
            </div>
        `;
        container.innerHTML = formHtml;
    }

    function renderDutiesForm() {
        const container = document.getElementById('duties-form');
        if (!container) return;

        const data = clearingAgentBillData.duties && clearingAgentBillData.duties.length > 0 
            ? clearingAgentBillData.duties[0] : {};

        const formHtml = `
            <input type="hidden" id="duties_id" value="${data.id || ''}">
            <div class="form-grid">
                <div class="form-group">
                    <label for="duty_custom_duty_value">Custom Duty Value</label>
                    <input type="number" step="0.01" id="duty_custom_duty_value" value="${data.custom_duty_value || ''}">
                </div>
                <div class="form-group">
                    <label for="duty_custom_duty_accessed_perc">Custom Duty Accessed %</label>
                    <input type="number" step="0.01" id="duty_custom_duty_accessed_perc" value="${data.custom_duty_accessed_perc || ''}">
                </div>
                <div class="form-group">
                    <label for="duty_acd_value">ACD Value</label>
                    <input type="number" step="0.01" id="duty_acd_value" value="${data.acd_value || ''}">
                </div>
                <div class="form-group">
                    <label for="duty_acd_accessed_perc">ACD Accessed %</label>
                    <input type="number" step="0.01" id="duty_acd_accessed_perc" value="${data.acd_accessed_perc || ''}">
                </div>
                <div class="form-group">
                    <label for="duty_sales_tax_value">Sales Tax Value</label>
                    <input type="number" step="0.01" id="duty_sales_tax_value" value="${data.sales_tax_value || ''}">
                </div>
                <div class="form-group">
                    <label for="duty_sales_tax_accessed_perc">Sales Tax Accessed %</label>
                    <input type="number" step="0.01" id="duty_sales_tax_accessed_perc" value="${data.sales_tax_accessed_perc || ''}">
                </div>
                <div class="form-group">
                    <label for="duty_income_tax_value">Income Tax Value</label>
                    <input type="number" step="0.01" id="duty_income_tax_value" value="${data.income_tax_value || ''}">
                </div>
                <div class="form-group">
                    <label for="duty_income_tax_accessed_perc">Income Tax Accessed %</label>
                    <input type="number" step="0.01" id="duty_income_tax_accessed_perc" value="${data.income_tax_accessed_perc || ''}">
                </div>
                <div class="form-group">
                    <label for="duty_excise_duty_value">Excise Duty Value</label>
                    <input type="number" step="0.01" id="duty_excise_duty_value" value="${data.excise_duty_value || ''}">
                </div>
                <div class="form-group">
                    <label for="duty_excise_duty_accessed_perc">Excise Duty Accessed %</label>
                    <input type="number" step="0.01" id="duty_excise_duty_accessed_perc" value="${data.excise_duty_accessed_perc || ''}">
                </div>
            </div>
        `;
        container.innerHTML = formHtml;
    }

    async function saveClearingAgentBill() {
        const { data: { user } } = await supabase.auth.getUser();
        
        const clearingAgentBillFormData = {
            shipment_id: shipmentId,
            bill_no: parseFloat(document.getElementById('cab_bill_no').value) || null,
            invoice_no: document.getElementById('cab_invoice_no').value || null,
            total_clearing_agent_value: parseFloat(document.getElementById('cab_total_clearing_agent_value').value) || null,
            total_clearing_agent_accessed_perc: parseFloat(document.getElementById('cab_total_clearing_agent_accessed_perc').value) || null,
            total_expense_shipment_value: parseFloat(document.getElementById('cab_total_expense_shipment_value').value) || null,
            total_expense_shipment_accessed_perc: parseFloat(document.getElementById('cab_total_expense_shipment_accessed_perc').value) || null,
            total_bill: parseFloat(document.getElementById('cab_total_bill').value) || null,
            duties: parseFloat(document.getElementById('cab_duties').value) || null,
            excise: parseFloat(document.getElementById('cab_excise').value) || null,
            advance_payments: parseFloat(document.getElementById('cab_advance_payments').value) || null,
            deduction: parseFloat(document.getElementById('cab_deduction').value) || null,
            net_payable: parseFloat(document.getElementById('cab_net_payable').value) || null,
            created_by: user.id
        };

        let clearingAgentBillId = document.getElementById('clearing_agent_bill_id').value;

        if (clearingAgentBillId) {
            const { error } = await supabase.from('clearing_agent_bill').update(clearingAgentBillFormData).eq('id', clearingAgentBillId);
            if (error) {
                showMessage('clearing-agent-bill-modal-message', `Error updating clearing agent bill: ${error.message}`, true);
                return;
            }
        } else {
            const { data, error } = await supabase.from('clearing_agent_bill').insert(clearingAgentBillFormData).select().single();
            if (error) {
                showMessage('clearing-agent-bill-modal-message', `Error creating clearing agent bill: ${error.message}`, true);
                return;
            }
            clearingAgentBillId = data.id;
            document.getElementById('clearing_agent_bill_id').value = clearingAgentBillId;
        }

        showToast('Clearing agent bill saved successfully!', true);
        
        // Save all child table data
        await saveAllChildTablesData(clearingAgentBillId);
        
        await openClearingAgentBillModal();
    }

    async function saveAllChildTablesData(clearingAgentBillId) {
        const { data: { user } } = await supabase.auth.getUser();

        // Save Agency Charges (One-to-One)
        const agencyChargesData = {
            clearing_agent_bill_id: clearingAgentBillId,
            weboc_token_value: parseFloat(document.getElementById('agency_weboc_token_value').value) || null,
            weboc_token_accessed_perc: parseFloat(document.getElementById('agency_weboc_token_accessed_perc').value) || null,
            transport_charges_value: parseFloat(document.getElementById('agency_transport_charges_value').value) || null,
            transport_charges_accessed_perc: parseFloat(document.getElementById('agency_transport_charges_accessed_perc').value) || null,
            sales_tax_value: parseFloat(document.getElementById('agency_sales_tax_value').value) || null,
            sales_tax_accessed_perc: parseFloat(document.getElementById('agency_sales_tax_accessed_perc').value) || null,
            created_by: user.id
        };

        const agencyChargesId = document.getElementById('agency_charges_id').value;
        if (agencyChargesId) {
            await supabase.from('agency_charges').update(agencyChargesData).eq('id', agencyChargesId);
        } else {
            await supabase.from('agency_charges').upsert(agencyChargesData, { onConflict: 'clearing_agent_bill_id' });
        }

        // Save Receipted Port Expense (One-to-One)
        const rpeData = {
            clearing_agent_bill_id: clearingAgentBillId,
            detention_value: parseFloat(document.getElementById('rpe_detention_value').value) || null,
            detention_accessed_perc: parseFloat(document.getElementById('rpe_detention_accessed_perc').value) || null,
            demmurage_value: parseFloat(document.getElementById('rpe_demmurage_value').value) || null,
            demmurage_accessed_perc: parseFloat(document.getElementById('rpe_demmurage_accessed_perc').value) || null,
            handling_charges_value: parseFloat(document.getElementById('rpe_handling_charges_value').value) || null,
            handling_charges_accessed_perc: parseFloat(document.getElementById('rpe_handling_charges_accessed_perc').value) || null,
            created_by: user.id
        };

        const rpeId = document.getElementById('receipted_port_expense_id').value;
        if (rpeId) {
            await supabase.from('receipted_port_expense').update(rpeData).eq('id', rpeId);
        } else {
            await supabase.from('receipted_port_expense').upsert(rpeData, { onConflict: 'clearing_agent_bill_id' });
        }

        // Save Payments (One-to-One)
        const paymentsData = {
            clearing_agent_bill_id: clearingAgentBillId,
            cd_value: parseFloat(document.getElementById('payment_cd_value').value) || null,
            cd_accessed_perc: parseFloat(document.getElementById('payment_cd_accessed_perc').value) || null,
            pra_or_ecs_value: parseFloat(document.getElementById('payment_pra_or_ecs_value').value) || null,
            pra_or_ecs_accessed_perc: parseFloat(document.getElementById('payment_pra_or_ecs_accessed_perc').value) || null,
            created_by: user.id
        };

        const paymentsId = document.getElementById('payments_id').value;
        if (paymentsId) {
            await supabase.from('payments').update(paymentsData).eq('id', paymentsId);
        } else {
            await supabase.from('payments').upsert(paymentsData, { onConflict: 'clearing_agent_bill_id' });
        }

        // Save Duties (One-to-One)
        const dutiesData = {
            clearing_agent_bill_id: clearingAgentBillId,
            custom_duty_value: parseFloat(document.getElementById('duty_custom_duty_value').value) || null,
            custom_duty_accessed_perc: parseFloat(document.getElementById('duty_custom_duty_accessed_perc').value) || null,
            acd_value: parseFloat(document.getElementById('duty_acd_value').value) || null,
            acd_accessed_perc: parseFloat(document.getElementById('duty_acd_accessed_perc').value) || null,
            sales_tax_value: parseFloat(document.getElementById('duty_sales_tax_value').value) || null,
            sales_tax_accessed_perc: parseFloat(document.getElementById('duty_sales_tax_accessed_perc').value) || null,
            income_tax_value: parseFloat(document.getElementById('duty_income_tax_value').value) || null,
            income_tax_accessed_perc: parseFloat(document.getElementById('duty_income_tax_accessed_perc').value) || null,
            excise_duty_value: parseFloat(document.getElementById('duty_excise_duty_value').value) || null,
            excise_duty_accessed_perc: parseFloat(document.getElementById('duty_excise_duty_accessed_perc').value) || null,
            created_by: user.id
        };

        const dutiesId = document.getElementById('duties_id').value;
        if (dutiesId) {
            await supabase.from('duties').update(dutiesData).eq('id', dutiesId);
        } else {
            await supabase.from('duties').upsert(dutiesData, { onConflict: 'clearing_agent_bill_id' });
        }
    }

    function addAgencyChargesForm() {
        const container = document.getElementById('add-agency-charges-form-container');
        const formHtml = `
            <div class="form-grid">
                <div class="form-group">
                    <label for="new_agency_weboc_token_value">WEBOC Token Value</label>
                    <input type="number" step="0.01" id="new_agency_weboc_token_value" name="new_agency_weboc_token_value">
                </div>
                <div class="form-group">
                    <label for="new_agency_weboc_token_accessed_perc">WEBOC Token Accessed %</label>
                    <input type="number" step="0.01" id="new_agency_weboc_token_accessed_perc" name="new_agency_weboc_token_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_agency_transport_charges_value">Transport Charges Value</label>
                    <input type="number" step="0.01" id="new_agency_transport_charges_value" name="new_agency_transport_charges_value">
                </div>
                <div class="form-group">
                    <label for="new_agency_transport_charges_accessed_perc">Transport Charges Accessed %</label>
                    <input type="number" step="0.01" id="new_agency_transport_charges_accessed_perc" name="new_agency_transport_charges_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_agency_sales_tax_value">Sales Tax Value</label>
                    <input type="number" step="0.01" id="new_agency_sales_tax_value" name="new_agency_sales_tax_value">
                </div>
                <div class="form-group">
                    <label for="new_agency_sales_tax_accessed_perc">Sales Tax Accessed %</label>
                    <input type="number" step="0.01" id="new_agency_sales_tax_accessed_perc" name="new_agency_sales_tax_accessed_perc">
                </div>
            </div>
            <button type="button" onclick="saveAgencyCharges()">Save Agency Charges</button>
            <button type="button" class="button-secondary" onclick="cancelAddAgencyCharges()">Cancel</button>
        `;
        container.innerHTML = formHtml;
    }

    function cancelAddAgencyCharges() {
        const container = document.getElementById('add-agency-charges-form-container');
        container.innerHTML = '';
    }

    async function saveAgencyCharges() {
        let clearingAgentBillId = document.getElementById('clearing_agent_bill_id').value;
        const { data: { user } } = await supabase.auth.getUser();

        if (!clearingAgentBillId) {
            const { data, error } = await supabase.from('clearing_agent_bill').insert({ 
                shipment_id: shipmentId, 
                created_by: user.id 
            }).select().single();
            if (error) {
                showMessage('clearing-agent-bill-modal-message', `Error creating clearing agent bill: ${error.message}`, true);
                return;
            }
            clearingAgentBillId = data.id;
            document.getElementById('clearing_agent_bill_id').value = clearingAgentBillId;
        }

        const agencyChargesData = {
            clearing_agent_bill_id: clearingAgentBillId,
            weboc_token_value: parseFloat(document.getElementById('new_agency_weboc_token_value').value) || null,
            weboc_token_accessed_perc: parseFloat(document.getElementById('new_agency_weboc_token_accessed_perc').value) || null,
            transport_charges_value: parseFloat(document.getElementById('new_agency_transport_charges_value').value) || null,
            transport_charges_accessed_perc: parseFloat(document.getElementById('new_agency_transport_charges_accessed_perc').value) || null,
            sales_tax_value: parseFloat(document.getElementById('new_agency_sales_tax_value').value) || null,
            sales_tax_accessed_perc: parseFloat(document.getElementById('new_agency_sales_tax_accessed_perc').value) || null,
            created_by: user.id
        };

        const { error } = await supabase.from('agency_charges').insert(agencyChargesData);

        if (error) {
            showMessage('clearing-agent-bill-modal-message', `Error saving agency charges: ${error.message}`, true);
        } else {
            showToast('Agency charges saved successfully!', true);
            cancelAddAgencyCharges();
            await openClearingAgentBillModal();
        }
    }

    // Similar functions for receipted port expense and payments would go here
    // For brevity, I'm including the main structure and the first child table implementation

    function addReceiptedPortExpenseForm() {
        const container = document.getElementById('add-receipted-port-expense-form-container');
        const formHtml = `
            <div class="form-grid">
                <div class="form-group">
                    <label for="new_rpe_detention_value">Detention Value</label>
                    <input type="number" step="0.01" id="new_rpe_detention_value" name="new_rpe_detention_value">
                </div>
                <div class="form-group">
                    <label for="new_rpe_detention_accessed_perc">Detention Accessed %</label>
                    <input type="number" step="0.01" id="new_rpe_detention_accessed_perc" name="new_rpe_detention_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_rpe_demmurage_value">Demmurage Value</label>
                    <input type="number" step="0.01" id="new_rpe_demmurage_value" name="new_rpe_demmurage_value">
                </div>
                <div class="form-group">
                    <label for="new_rpe_demmurage_accessed_perc">Demmurage Accessed %</label>
                    <input type="number" step="0.01" id="new_rpe_demmurage_accessed_perc" name="new_rpe_demmurage_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_rpe_handling_charges_value">Handling Charges Value</label>
                    <input type="number" step="0.01" id="new_rpe_handling_charges_value" name="new_rpe_handling_charges_value">
                </div>
                <div class="form-group">
                    <label for="new_rpe_handling_charges_accessed_perc">Handling Charges Accessed %</label>
                    <input type="number" step="0.01" id="new_rpe_handling_charges_accessed_perc" name="new_rpe_handling_charges_accessed_perc">
                </div>
            </div>
            <button type="button" onclick="saveReceiptedPortExpense()">Save Port Expense</button>
            <button type="button" class="button-secondary" onclick="cancelAddReceiptedPortExpense()">Cancel</button>
        `;
        container.innerHTML = formHtml;
    }

    function cancelAddReceiptedPortExpense() {
        const container = document.getElementById('add-receipted-port-expense-form-container');
        container.innerHTML = '';
    }

    async function saveReceiptedPortExpense() {
        let clearingAgentBillId = document.getElementById('clearing_agent_bill_id').value;
        const { data: { user } } = await supabase.auth.getUser();

        if (!clearingAgentBillId) {
            const { data, error } = await supabase.from('clearing_agent_bill').insert({ 
                shipment_id: shipmentId, 
                created_by: user.id 
            }).select().single();
            if (error) {
                showMessage('clearing-agent-bill-modal-message', `Error creating clearing agent bill: ${error.message}`, true);
                return;
            }
            clearingAgentBillId = data.id;
            document.getElementById('clearing_agent_bill_id').value = clearingAgentBillId;
        }

        const receiptedPortExpenseData = {
            clearing_agent_bill_id: clearingAgentBillId,
            detention_value: parseFloat(document.getElementById('new_rpe_detention_value').value) || null,
            detention_accessed_perc: parseFloat(document.getElementById('new_rpe_detention_accessed_perc').value) || null,
            demmurage_value: parseFloat(document.getElementById('new_rpe_demmurage_value').value) || null,
            demmurage_accessed_perc: parseFloat(document.getElementById('new_rpe_demmurage_accessed_perc').value) || null,
            handling_charges_value: parseFloat(document.getElementById('new_rpe_handling_charges_value').value) || null,
            handling_charges_accessed_perc: parseFloat(document.getElementById('new_rpe_handling_charges_accessed_perc').value) || null,
            created_by: user.id
        };

        const { error } = await supabase.from('receipted_port_expense').insert(receiptedPortExpenseData);

        if (error) {
            showMessage('clearing-agent-bill-modal-message', `Error saving receipted port expense: ${error.message}`, true);
        } else {
            showToast('Receipted port expense saved successfully!', true);
            cancelAddReceiptedPortExpense();
            await openClearingAgentBillModal();
        }
    }

    function addPaymentsForm() {
        const container = document.getElementById('add-payments-form-container');
        const formHtml = `
            <div class="form-grid">
                <div class="form-group">
                    <label for="new_payment_cd_value">CD Value</label>
                    <input type="number" step="0.01" id="new_payment_cd_value" name="new_payment_cd_value">
                </div>
                <div class="form-group">
                    <label for="new_payment_cd_accessed_perc">CD Accessed %</label>
                    <input type="number" step="0.01" id="new_payment_cd_accessed_perc" name="new_payment_cd_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_payment_pra_or_ecs_value">PRA or ECS Value</label>
                    <input type="number" step="0.01" id="new_payment_pra_or_ecs_value" name="new_payment_pra_or_ecs_value">
                </div>
                <div class="form-group">
                    <label for="new_payment_pra_or_ecs_accessed_perc">PRA or ECS Accessed %</label>
                    <input type="number" step="0.01" id="new_payment_pra_or_ecs_accessed_perc" name="new_payment_pra_or_ecs_accessed_perc">
                </div>
            </div>
            <button type="button" onclick="savePayments()">Save Payments</button>
            <button type="button" class="button-secondary" onclick="cancelAddPayments()">Cancel</button>
        `;
        container.innerHTML = formHtml;
    }

    function cancelAddPayments() {
        const container = document.getElementById('add-payments-form-container');
        container.innerHTML = '';
    }

    async function savePayments() {
        let clearingAgentBillId = document.getElementById('clearing_agent_bill_id').value;
        const { data: { user } } = await supabase.auth.getUser();

        if (!clearingAgentBillId) {
            const { data, error } = await supabase.from('clearing_agent_bill').insert({ 
                shipment_id: shipmentId, 
                created_by: user.id 
            }).select().single();
            if (error) {
                showMessage('clearing-agent-bill-modal-message', `Error creating clearing agent bill: ${error.message}`, true);
                return;
            }
            clearingAgentBillId = data.id;
            document.getElementById('clearing_agent_bill_id').value = clearingAgentBillId;
        }

        const paymentsData = {
            clearing_agent_bill_id: clearingAgentBillId,
            cd_value: parseFloat(document.getElementById('new_payment_cd_value').value) || null,
            cd_accessed_perc: parseFloat(document.getElementById('new_payment_cd_accessed_perc').value) || null,
            pra_or_ecs_value: parseFloat(document.getElementById('new_payment_pra_or_ecs_value').value) || null,
            pra_or_ecs_accessed_perc: parseFloat(document.getElementById('new_payment_pra_or_ecs_accessed_perc').value) || null,
            created_by: user.id
        };

        const { error } = await supabase.from('payments').insert(paymentsData);

        if (error) {
            showMessage('clearing-agent-bill-modal-message', `Error saving payments: ${error.message}`, true);
        } else {
            showToast('Payments saved successfully!', true);
            cancelAddPayments();
            await openClearingAgentBillModal();
        }
    }

    async function deleteAgencyCharge(chargeId) {
        if (!confirm('Are you sure you want to delete this agency charge?')) {
            return;
        }

        const { error } = await supabase.from('agency_charges').delete().eq('id', chargeId);

        if (error) {
            showMessage('clearing-agent-bill-modal-message', `Error deleting agency charge: ${error.message}`, true);
        } else {
            showToast('Agency charge deleted successfully!', true);
            await openClearingAgentBillModal();
        }
    }

    async function deleteReceiptedPortExpense(expenseId) {
        if (!confirm('Are you sure you want to delete this receipted port expense?')) {
            return;
        }

        const { error } = await supabase.from('receipted_port_expense').delete().eq('id', expenseId);

        if (error) {
            showMessage('clearing-agent-bill-modal-message', `Error deleting receipted port expense: ${error.message}`, true);
        } else {
            showToast('Receipted port expense deleted successfully!', true);
            await openClearingAgentBillModal();
        }
    }

    async function deletePayment(paymentId) {
        if (!confirm('Are you sure you want to delete this payment?')) {
            return;
        }

        const { error } = await supabase.from('payments').delete().eq('id', paymentId);

        if (error) {
            showMessage('clearing-agent-bill-modal-message', `Error deleting payment: ${error.message}`, true);
        } else {
            showToast('Payment deleted successfully!', true);
            await openClearingAgentBillModal();
        }
    }

    function renderDutiesList() {
        const container = document.getElementById('duties-list');
        if (!container) return;

        let html = '';
        if (clearingAgentBillData.duties && clearingAgentBillData.duties.length > 0) {
            clearingAgentBillData.duties.forEach(duty => {
                html += `
                <div class="charge-item" data-duty-id="${duty.id}">
                    <div class="charge-item-header">
                        <div class="charge-name">Duties & Taxes</div>
                        <div class="charge-actions">
                            <button class="delete-btn" onclick="deleteDuty('${duty.id}')">Delete</button>
                        </div>
                    </div>
                    <div class="charge-description">Custom Duty: ${duty.custom_duty_value || 'N/A'}, Sales Tax: ${duty.sales_tax_value || 'N/A'}</div>
                </div>`;
            });
        }
        
        if (html === '') {
            html = '<p class="no-data">No duties added yet.</p>';
        }
        
        container.innerHTML = html;
    }

    function addDutiesForm() {
        const container = document.getElementById('add-duties-form-container');
        const formHtml = `
            <div class="form-grid">
                <div class="form-group">
                    <label for="new_duty_custom_duty_value">Custom Duty Value</label>
                    <input type="number" step="0.01" id="new_duty_custom_duty_value" name="new_duty_custom_duty_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_custom_duty_accessed_perc">Custom Duty Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_custom_duty_accessed_perc" name="new_duty_custom_duty_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_duty_acd_value">ACD Value</label>
                    <input type="number" step="0.01" id="new_duty_acd_value" name="new_duty_acd_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_acd_accessed_perc">ACD Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_acd_accessed_perc" name="new_duty_acd_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_duty_sales_tax_value">Sales Tax Value</label>
                    <input type="number" step="0.01" id="new_duty_sales_tax_value" name="new_duty_sales_tax_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_sales_tax_accessed_perc">Sales Tax Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_sales_tax_accessed_perc" name="new_duty_sales_tax_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_duty_ast_value">AST Value</label>
                    <input type="number" step="0.01" id="new_duty_ast_value" name="new_duty_ast_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_ast_accessed_perc">AST Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_ast_accessed_perc" name="new_duty_ast_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_duty_income_tax_value">Income Tax Value</label>
                    <input type="number" step="0.01" id="new_duty_income_tax_value" name="new_duty_income_tax_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_income_tax_accessed_perc">Income Tax Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_income_tax_accessed_perc" name="new_duty_income_tax_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_duty_invoice_not_found_value">Invoice Not Found Value</label>
                    <input type="number" step="0.01" id="new_duty_invoice_not_found_value" name="new_duty_invoice_not_found_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_invoice_not_found_accessed_perc">Invoice Not Found Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_invoice_not_found_accessed_perc" name="new_duty_invoice_not_found_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_duty_sub_total_value">Sub Total Value</label>
                    <input type="number" step="0.01" id="new_duty_sub_total_value" name="new_duty_sub_total_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_sub_total_accessed_perc">Sub Total Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_sub_total_accessed_perc" name="new_duty_sub_total_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_duty_excise_duty_value">Excise Duty Value</label>
                    <input type="number" step="0.01" id="new_duty_excise_duty_value" name="new_duty_excise_duty_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_excise_duty_accessed_perc">Excise Duty Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_excise_duty_accessed_perc" name="new_duty_excise_duty_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_duty_release_orders_value">Release Orders Value</label>
                    <input type="number" step="0.01" id="new_duty_release_orders_value" name="new_duty_release_orders_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_release_orders_accessed_perc">Release Orders Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_release_orders_accessed_perc" name="new_duty_release_orders_accessed_perc">
                </div>
                <div class="form-group">
                    <label for="new_duty_single_decleration_value">Single Declaration Value</label>
                    <input type="number" step="0.01" id="new_duty_single_decleration_value" name="new_duty_single_decleration_value">
                </div>
                <div class="form-group">
                    <label for="new_duty_single_decleration_accessed_perc">Single Declaration Accessed %</label>
                    <input type="number" step="0.01" id="new_duty_single_decleration_accessed_perc" name="new_duty_single_decleration_accessed_perc">
                </div>
            </div>
            <button type="button" onclick="saveDuties()">Save Duties</button>
            <button type="button" class="button-secondary" onclick="cancelAddDuties()">Cancel</button>
        `;
        container.innerHTML = formHtml;
    }

    function cancelAddDuties() {
        const container = document.getElementById('add-duties-form-container');
        container.innerHTML = '';
    }

    async function saveDuties() {
        let clearingAgentBillId = document.getElementById('clearing_agent_bill_id').value;
        const { data: { user } } = await supabase.auth.getUser();

        if (!clearingAgentBillId) {
            const { data, error } = await supabase.from('clearing_agent_bill').insert({ 
                shipment_id: shipmentId, 
                created_by: user.id 
            }).select().single();
            if (error) {
                showMessage('clearing-agent-bill-modal-message', `Error creating clearing agent bill: ${error.message}`, true);
                return;
            }
            clearingAgentBillId = data.id;
            document.getElementById('clearing_agent_bill_id').value = clearingAgentBillId;
        }

        const dutiesData = {
            clearing_agent_bill_id: clearingAgentBillId,
            custom_duty_value: parseFloat(document.getElementById('new_duty_custom_duty_value').value) || null,
            custom_duty_accessed_perc: parseFloat(document.getElementById('new_duty_custom_duty_accessed_perc').value) || null,
            acd_value: parseFloat(document.getElementById('new_duty_acd_value').value) || null,
            acd_accessed_perc: parseFloat(document.getElementById('new_duty_acd_accessed_perc').value) || null,
            sales_tax_value: parseFloat(document.getElementById('new_duty_sales_tax_value').value) || null,
            sales_tax_accessed_perc: parseFloat(document.getElementById('new_duty_sales_tax_accessed_perc').value) || null,
            ast_value: parseFloat(document.getElementById('new_duty_ast_value').value) || null,
            ast_accessed_perc: parseFloat(document.getElementById('new_duty_ast_accessed_perc').value) || null,
            income_tax_value: parseFloat(document.getElementById('new_duty_income_tax_value').value) || null,
            income_tax_accessed_perc: parseFloat(document.getElementById('new_duty_income_tax_accessed_perc').value) || null,
            invoice_not_found_value: parseFloat(document.getElementById('new_duty_invoice_not_found_value').value) || null,
            invoice_not_found_accessed_perc: parseFloat(document.getElementById('new_duty_invoice_not_found_accessed_perc').value) || null,
            sub_total_value: parseFloat(document.getElementById('new_duty_sub_total_value').value) || null,
            sub_total_accessed_perc: parseFloat(document.getElementById('new_duty_sub_total_accessed_perc').value) || null,
            excise_duty_value: parseFloat(document.getElementById('new_duty_excise_duty_value').value) || null,
            excise_duty_accessed_perc: parseFloat(document.getElementById('new_duty_excise_duty_accessed_perc').value) || null,
            release_orders_value: parseFloat(document.getElementById('new_duty_release_orders_value').value) || null,
            release_orders_accessed_perc: parseFloat(document.getElementById('new_duty_release_orders_accessed_perc').value) || null,
            single_decleration_value: parseFloat(document.getElementById('new_duty_single_decleration_value').value) || null,
            single_decleration_accessed_perc: parseFloat(document.getElementById('new_duty_single_decleration_accessed_perc').value) || null,
            created_by: user.id
        };

        const { error } = await supabase.from('duties').insert(dutiesData);

        if (error) {
            showMessage('clearing-agent-bill-modal-message', `Error saving duties: ${error.message}`, true);
        } else {
            showToast('Duties saved successfully!', true);
            cancelAddDuties();
            await openClearingAgentBillModal();
        }
    }

    async function deleteDuty(dutyId) {
        if (!confirm('Are you sure you want to delete this duty?')) {
            return;
        }

        const { error } = await supabase.from('duties').delete().eq('id', dutyId);

        if (error) {
            showMessage('clearing-agent-bill-modal-message', `Error deleting duty: ${error.message}`, true);
        } else {
            showToast('Duty deleted successfully!', true);
            await openClearingAgentBillModal();
        }
    }

    function cancelClearingAgentBillEdit() {
        renderClearingAgentBillView();
    }

    function closeClearingAgentBillModal() {
        const modal = document.getElementById('clearing-agent-bill-modal');
        modal.classList.remove('show');
    }

    // Make clearing agent bill functions globally available
    window.openClearingAgentBillModal = openClearingAgentBillModal;
    window.closeClearingAgentBillModal = closeClearingAgentBillModal;
    window.saveClearingAgentBill = saveClearingAgentBill;
    window.renderClearingAgentBillEdit = renderClearingAgentBillEdit;
    window.renderClearingAgentBillView = renderClearingAgentBillView;
    window.cancelClearingAgentBillEdit = cancelClearingAgentBillEdit;

    // Bank Charges Modal Functions
    window.openBankChargesModal = openBankChargesModal;
    window.closeBankChargesModal = closeBankChargesModal;
    window.saveBankCharges = saveBankCharges;
    window.renderBankChargesView = renderBankChargesView;
    window.renderBankChargesEdit = renderBankChargesEdit;
    window.cancelBankChargesEdit = cancelBankChargesEdit;
    window.addDocumentForm = addDocumentForm;
    window.cancelAddDocument = cancelAddDocument;
    window.saveBankChargeDocument = saveBankChargeDocument;

    // Insurance Modal Functions
    window.openInsuranceModal = openInsuranceModal;
    window.closeInsuranceModal = closeInsuranceModal;
    window.saveInsurance = saveInsurance;
    window.renderInsuranceView = renderInsuranceView;
    window.renderInsuranceEdit = renderInsuranceEdit;
    window.cancelInsuranceEdit = cancelInsuranceEdit;
    window.addInsuranceDocumentForm = addInsuranceDocumentForm;
    window.cancelAddInsuranceDocument = cancelAddInsuranceDocument;
    window.saveInsuranceDocument = saveInsuranceDocument;

    window.openStageModal = openStageModal;
    window.closeModal = closeModal;
    window.saveStageDetails = saveStageDetails;
    window.renderStageEdit = renderStageEdit;
    window.renderStageView = renderStageView;

    // Supplier Details Functions
    async function loadSupplierDetails(shipmentData) {
        try {
            console.log('🔍 Loading supplier details for shipment:', shipmentData);
            
            // Get supplier from the first product (assuming all products have the same supplier for now)
            const firstProduct = shipmentData.shipment_products[0];
            if (!firstProduct || !firstProduct.product_variety.supplier_id) {
                console.warn('No supplier found for this shipment');
                showSupplierError('No supplier assigned to this shipment');
                return;
            }
            
            const supplierId = firstProduct.product_variety.supplier_id;
            console.log('📊 Supplier ID found:', supplierId);
            
            // Fetch detailed supplier information
            const { data: supplierData, error: supplierError } = await supabase
                .from('supplier')
                .select(`
                    *,
                    supplier_office (
                        office_type,
                        address
                    )
                `)
                .eq('id', supplierId)
                .single();
            
            if (supplierError) {
                console.error('Error loading supplier details:', supplierError);
                showSupplierError('Error loading supplier information');
                return;
            }
            
            console.log('✅ Supplier data loaded:', supplierData);
            
            // Fetch supplier shipment statistics
            let statsData = null;
            try {
                const { data: rpcData, error: rpcError } = await supabase
                    .rpc('get_supplier_shipment_stats', { supplier_id: supplierId });
                
                if (rpcError) {
                    console.error('RPC error loading supplier stats:', rpcError);
                    
                    // Fallback: try direct query
                    console.log('🔄 Trying fallback stats query...');
                    const { data: fallbackData, error: fallbackError } = await supabase
                        .from('shipment')
                        .select(`
                            id,
                            status,
                            current_stage,
                            shipment_products!inner (
                                product_variety!inner (
                                    supplier_id
                                )
                            )
                        `)
                        .eq('shipment_products.product_variety.supplier_id', supplierId);
                    
                    if (!fallbackError && fallbackData) {
                        console.log('📊 Fallback data received:', fallbackData);
                        
                        // Calculate stats manually
                        const totalShipments = fallbackData.length;
                        const completedShipments = fallbackData.filter(s => s.status === 'completed').length;
                        const activeShipments = fallbackData.filter(s => s.status !== 'completed').length;
                        const onTimeShipments = fallbackData.filter(s => s.status === 'completed' && s.current_stage === 'bills').length;
                        
                        statsData = [{
                            total_shipments: totalShipments,
                            active_shipments: activeShipments,
                            completed_shipments: completedShipments,
                            on_time_shipments: onTimeShipments
                        }];
                    } else {
                        console.error('Fallback query also failed:', fallbackError);
                    }
                } else {
                    statsData = rpcData;
                    console.log('📈 RPC Stats data received:', statsData);
                }
            } catch (statsError) {
                console.error('Error in stats loading process:', statsError);
            }
            
            // Populate supplier details UI
            populateSupplierDetails(supplierData, statsData || [], shipmentData);
            
        } catch (error) {
            console.error('Unexpected error loading supplier details:', error);
            showSupplierError('Unexpected error occurred');
        }
    }

    function populateSupplierDetails(supplier, stats, shipmentData) {
        console.log('🎨 Populating supplier details UI');
        console.log('Supplier data:', supplier);
        console.log('Stats data:', stats);
        
        // Update supplier name and type
        document.getElementById('supplierName').textContent = supplier.name || 'Unknown Supplier';
        document.getElementById('supplierType').textContent = 'Agricultural Supplier';
        
        // Update contact information
        document.getElementById('supplierEmail').textContent = supplier.contact_email || 'Not provided';
        document.getElementById('supplierPhone').textContent = supplier.contact_phone || 'Not provided';
        
        // Update location (from supplier office if available)
        const office = supplier.supplier_office && supplier.supplier_office[0];
        document.getElementById('supplierLocation').textContent = office?.address || 'Not specified';
        
        // Update metrics (handle stats data properly)
        let supplierStats = {};
        if (Array.isArray(stats) && stats.length > 0) {
            supplierStats = stats[0];
        } else if (stats && typeof stats === 'object') {
            supplierStats = stats;
        }
        
        console.log('📊 Processing stats:', supplierStats);
        
        document.getElementById('supplierTotalShipments').textContent = supplierStats.total_shipments || '0';
        document.getElementById('supplierActiveShipments').textContent = supplierStats.active_shipments || '0';
        document.getElementById('supplierCompletedShipments').textContent = supplierStats.completed_shipments || '0';
        
        // Calculate on-time rate
        const onTimeRate = supplierStats.total_shipments > 0 
            ? Math.round((supplierStats.completed_shipments / supplierStats.total_shipments) * 100) 
            : 0;
        document.getElementById('supplierOnTimeRate').textContent = `${onTimeRate}%`;
        
        console.log('✅ Stats populated:', {
            total: supplierStats.total_shipments,
            active: supplierStats.active_shipments,
            completed: supplierStats.completed_shipments,
            onTime: onTimeRate
        });
        
        // Update LC sharing status
        const lcSharing = document.getElementById('lcSharingStatus');
        const lcToggleBtn = document.getElementById('lcToggleBtn');
        const lcValue = document.getElementById('lcSharingValue');
        
        if (supplier.is_lc_shared) {
            lcValue.textContent = 'Shared';
            lcToggleBtn.innerHTML = '<i class="fas fa-check"></i> LC Shared';
            lcToggleBtn.classList.add('shared');
            lcSharing.style.display = 'block';
        } else {
            lcValue.textContent = 'Not Shared';
            lcToggleBtn.innerHTML = '<i class="fas fa-share"></i> Share LC';
            lcToggleBtn.classList.remove('shared');
            
            // Only show LC sharing section if shipment is in LC stage
            const currentStage = shipmentData.current_stage;
            if (currentStage === 'lc_opening') {
                lcSharing.style.display = 'block';
            }
        }
        
        // Store supplier ID for actions
        window.currentSupplierId = supplier.id;
        
        console.log('🎯 Supplier details UI populated successfully');
    }

    function showSupplierError(message) {
        const card = document.getElementById('supplierDetailsCard');
        card.innerHTML = `
            <div class="supplier-error">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="error-message">
                    <h4>Unable to load supplier details</h4>
                    <p>${message}</p>
                </div>
            </div>
        `;
    }

    // Supplier action functions
    function viewSupplierProfile() {
        if (window.currentSupplierId) {
            window.open(`supplier-details.html?id=${window.currentSupplierId}`, '_blank');
        } else {
            showToast('Supplier information not available', false);
        }
    }

    function contactSupplier() {
        const email = document.getElementById('supplierEmail').textContent;
        if (email && email !== 'Not provided') {
            window.location.href = `mailto:${email}?subject=Regarding Shipment ${document.querySelector('.shipment-id').textContent}`;
        } else {
            showToast('Supplier email not available', false);
        }
    }

    function viewSupplierShipments() {
        if (window.currentSupplierId) {
            // Open supplier-details.html with business view and specific supplier
            window.location.href = `supplier-details.html?view=business&supplier=${window.currentSupplierId}`;
        } else {
            showToast('Supplier information not available', false);
        }
    }

    async function toggleLCSharing() {
        if (!window.currentSupplierId) {
            showToast('Supplier information not available', false);
            return;
        }
        
        try {
            const currentValue = document.getElementById('lcSharingValue').textContent === 'Shared';
            const newValue = !currentValue;
            
            const { error } = await supabase
                .from('supplier')
                .update({ is_lc_shared: newValue })
                .eq('id', window.currentSupplierId);
            
            if (error) {
                showToast('Error updating LC sharing status', false);
                return;
            }
            
            // Update UI
            const lcValue = document.getElementById('lcSharingValue');
            const lcToggleBtn = document.getElementById('lcToggleBtn');
            
            if (newValue) {
                lcValue.textContent = 'Shared';
                lcToggleBtn.innerHTML = '<i class="fas fa-check"></i> LC Shared';
                lcToggleBtn.classList.add('shared');
                showToast('LC sharing status updated to Shared', true);
            } else {
                lcValue.textContent = 'Not Shared';
                lcToggleBtn.innerHTML = '<i class="fas fa-share"></i> Share LC';
                lcToggleBtn.classList.remove('shared');
                showToast('LC sharing status updated to Not Shared', true);
            }
            
        } catch (error) {
            console.error('Error toggling LC sharing:', error);
            showToast('Unexpected error occurred', false);
        }
    }

    // Make supplier functions globally available
    window.viewSupplierProfile = viewSupplierProfile;
    window.contactSupplier = contactSupplier;
    window.viewSupplierShipments = viewSupplierShipments;
    window.toggleLCSharing = toggleLCSharing;

    // Debug function - remove after testing
    window.debugSupplierStats = async function() {
        console.log('🐛 DEBUG: Manual supplier stats test');
        
        if (!window.currentSupplierId) {
            alert('No supplier ID available');
            return;
        }
        
        try {
            // Test RPC function
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('get_supplier_shipment_stats', { supplier_id: window.currentSupplierId });
            
            console.log('RPC Result:', { data: rpcData, error: rpcError });
            
            // Test direct query
            const { data: directData, error: directError } = await supabase
                .from('shipment')
                .select(`
                    id,
                    status,
                    current_stage,
                    shipment_products!inner (
                        product_variety!inner (
                            supplier_id
                        )
                    )
                `)
                .eq('shipment_products.product_variety.supplier_id', window.currentSupplierId);
            
            console.log('Direct Query Result:', { data: directData, error: directError });
            
            // Show results
            alert(`Debug Results:
RPC Error: ${rpcError?.message || 'None'}
RPC Data: ${JSON.stringify(rpcData)}
Direct Query Error: ${directError?.message || 'None'}
Direct Data Count: ${directData?.length || 0}`);
            
        } catch (error) {
            console.error('Debug error:', error);
            alert('Debug failed: ' + error.message);
        }
    };

    function setupFbrDutyEventListeners() {
        const fbrDutyForm = document.getElementById('fbr-duty-form');
        if (fbrDutyForm) {
            fbrDutyForm.addEventListener('input', (event) => {
                const fieldsToWatch = [
                    'fbr_invoice_amount', 'fbr_insurance_fix', 'fbr_landing_charges_rate', 'fbr_usd_rate',
                    'fbr_custom_duty_rate', 'fbr_additional_custom_duty_rate', 'fbr_regulatory_duty_rate',
                    'fbr_sales_tax_rate', 'fbr_additional_sales_tax_rate', 'fbr_income_tax_rate',
                    'fbr_excise_on_a_value_rate', 'fbr_l_single_declaration_amount', 'fbr_m_release_order_amount',
                    'fbr_n_stamp_duty_amount', 'fbr_as_per_psid'
                ];
                if (fieldsToWatch.includes(event.target.id)) {
                    calculateFbrDutyOnChange();
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initializeTracker();
        setupFbrDutyEventListeners();
        setupDocumentsManager();
    });

    // ===================================
    // Documents Manager
    // ===================================

    let documentsShipmentId = null;
    let documentsData = [];

    function setupDocumentsManager() {
        console.log('🔧 Setting up documents manager...');
        
        // Attach event to "Manage Documents" button
        const documentsBtn = document.querySelector('.documents-stage-btn');
        console.log('📁 Documents button found:', documentsBtn);
        
        if (documentsBtn) {
            documentsBtn.addEventListener('click', async function(e) {
                console.log('🖱️ Documents button clicked!');
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    console.log('🚀 Calling openDocumentsModal...');
                    await openDocumentsModal();
                    console.log('✅ openDocumentsModal completed');
                } catch (error) {
                    console.error('❌ Error in openDocumentsModal:', error);
                }
            });
            console.log('✅ Event listener attached to documents button');
        } else {
            console.error('❌ Documents button not found!');
        }
        
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

    window.openDocumentsModal = async function() {
        console.log('📂 Opening documents modal...');
        
        const modal = document.getElementById('documents-stage-modal');
        console.log('📋 Modal element:', modal);
        
        if (!modal) {
            console.error('❌ Documents modal not found');
            return;
        }
        
        console.log('✅ Adding show class to modal');
        modal.classList.add('show');
        
        // Get shipment ID from URL
        documentsShipmentId = shipmentId || urlParams.get('id');
        console.log('🆔 Shipment ID:', documentsShipmentId);
        
        if (documentsShipmentId) {
            console.log('📥 Loading required documents checklist...');
            await loadRequiredDocumentsChecklist();
            console.log('📥 Loading uploaded documents...');
            await loadDocumentsForShipment();
        } else {
            console.warn('⚠️ No shipment ID found');
        }
    };

    window.closeDocumentsModal = function() {
        const modal = document.getElementById('documents-stage-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    };

    async function loadRequiredDocumentsChecklist() {
        const section = document.getElementById('required-docs-section');
        const list = document.getElementById('required-docs-list');
        const badge = document.getElementById('completion-badge');
        const percentage = document.getElementById('completion-percentage');
        
        try {
            // Call the function to get required documents
            const { data, error } = await supabase
                .rpc('get_required_documents', { p_shipment_id: documentsShipmentId });
            
            if (error) {
                console.error('Error loading required docs:', error);
                section.style.display = 'none';
                return;
            }
            
            if (!data || data.length === 0) {
                section.style.display = 'none';
                return;
            }
            
            // Show the section
            section.style.display = 'block';
            
            // Debug logging
            console.log('📋 Required Documents Data:', data);
            console.log('📋 Full data with is_uploaded values:', data.map(d => ({
                doc_type: d.doc_type,
                doc_name: d.doc_name,
                is_mandatory: d.is_mandatory,
                is_uploaded: d.is_uploaded
            })));
            
            // Calculate completion
            const mandatory = data.filter(d => d.is_mandatory);
            const uploaded = mandatory.filter(d => d.is_uploaded);
            
            console.log('📊 Mandatory docs:', mandatory.length);
            console.log('✅ Uploaded docs:', uploaded.length);
            console.log('📝 Uploaded docs list:', uploaded.map(d => d.doc_type));
            console.log('🔍 Missing docs:', mandatory.filter(d => !d.is_uploaded).map(d => d.doc_type));
            
            const completionPerc = mandatory.length > 0 ? Math.round((uploaded.length / mandatory.length) * 100) : 100;
            
            // Update badge
            percentage.textContent = completionPerc + '%';
            badge.className = 'completion-badge';
            if (completionPerc === 100) {
                badge.classList.add('complete');
            } else {
                badge.classList.add('incomplete');
            }
            
            // Render checklist
            list.innerHTML = '';
            data.forEach(doc => {
                const item = document.createElement('div');
                const statusClass = doc.is_uploaded ? 'uploaded' : 'missing';
                const optionalClass = doc.is_mandatory ? '' : 'optional';
                
                item.className = `required-doc-item ${statusClass} ${optionalClass}`;
                item.innerHTML = `
                    <div class="doc-check-icon ${statusClass}">
                        <i class="fas ${doc.is_uploaded ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                    </div>
                    <div class="doc-info">
                        <div class="doc-info-name">${doc.doc_name}</div>
                        <div class="doc-info-desc">${doc.description || ''}</div>
                    </div>
                    <span class="doc-mandatory-badge ${doc.is_mandatory ? 'mandatory' : 'optional'}">
                        ${doc.is_mandatory ? 'Required' : 'Optional'}
                    </span>
                `;
                list.appendChild(item);
            });
            
        } catch (err) {
            console.error('Error in loadRequiredDocumentsChecklist:', err);
            section.style.display = 'none';
        }
    }

    async function loadDocumentsForShipment() {
        const grid = document.getElementById('documents-grid');
        const empty = document.getElementById('documents-empty-state');
        const loading = document.getElementById('documents-loading');
        
        try {
            if (loading) loading.style.display = 'block';
            if (empty) empty.style.display = 'none';
            
            const { data, error } = await supabase
                .from('document')
                .select('*, uploader:uploaded_by(full_name, email)')
                .eq('shipment_id', documentsShipmentId)
                .order('uploaded_at', { ascending: false });
            
            if (error) throw error;
            
            // Debug: Show what documents are in the database
            console.log('📄 Documents in database:', data?.length || 0);
            console.log('📄 Document types in DB:', data?.map(d => ({
                doc_type: d.doc_type,
                status: d.status,
                file_name: d.file_name
            })));
            
            documentsData = data || [];
            
            if (loading) loading.style.display = 'none';
            
            renderDocuments();
        } catch (err) {
            console.error('Error loading documents:', err);
            if (loading) loading.style.display = 'none';
            showDocumentsMessage('Failed to load documents: ' + err.message, 'error');
        }
    }

    function renderDocuments() {
        const grid = document.getElementById('documents-grid');
        const empty = document.getElementById('documents-empty-state');
        const template = document.getElementById('document-card-template');
        
        if (!grid || !template) return;
        
        // Clear existing documents
        grid.querySelectorAll('.document-card').forEach(c => c.remove());
        
        if (documentsData.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }
        
        if (empty) empty.style.display = 'none';
        
        documentsData.forEach(doc => {
            const card = template.content.cloneNode(true);
            const cardDiv = card.querySelector('.document-card');
            
            cardDiv.dataset.docId = doc.id;
            cardDiv.dataset.fileUrl = doc.file_url;
            
            // Set icon based on file type
            const icon = card.querySelector('.document-icon i');
            const fileExt = doc.file_url.split('.').pop().toLowerCase();
            const iconMap = {
                'pdf': 'fas fa-file-pdf',
                'doc': 'fas fa-file-word',
                'docx': 'fas fa-file-word',
                'jpg': 'fas fa-file-image',
                'jpeg': 'fas fa-file-image',
                'png': 'fas fa-file-image'
            };
            icon.className = iconMap[fileExt] || 'fas fa-file';
            
            const fileName = doc.file_url.split('/').pop();
            
            // Format document type
            const docType = doc.doc_type.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            
            // Show doc type as title, file name as subtitle (wrapped)
            card.querySelector('.document-title').textContent = docType;
            card.querySelector('.document-type').textContent = fileName;
            
            // Add word-wrap styling to subtitle
            const typeElement = card.querySelector('.document-type');
            typeElement.style.wordWrap = 'break-word';
            typeElement.style.wordBreak = 'break-all';
            typeElement.style.whiteSpace = 'normal';
            
            const date = new Date(doc.uploaded_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            card.querySelector('.document-date').innerHTML = `<i class="fas fa-calendar"></i> ${date}`;
            
            const uploaderName = doc.uploader?.full_name || 'Unknown';
            card.querySelector('.document-uploader').innerHTML = `<i class="fas fa-user"></i> ${uploaderName}`;
            
            grid.appendChild(card);
        });
    }

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
            
            showDocumentsMessage('Uploading document...', 'info');
            
            // Upload file to Supabase Storage
            const fileName = `${documentsShipmentId}/${Date.now()}_${file.name}`;
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
                    shipment_id: documentsShipmentId,
                    doc_type: docType,
                    file_url: urlData.publicUrl,
                    uploaded_by: user.id,
                    status: 'active'
                    // Note: file_name column needs to be added to database first
                    // Run: add_file_name_to_document_table.sql
                })
                .select()
                .single();
            
            if (docError) throw docError;
            
            showDocumentsMessage('Document uploaded successfully!', 'success');
            
            // Reset form
            e.target.reset();
            
            // Reload required docs checklist and documents list
            await loadRequiredDocumentsChecklist();
            await loadDocumentsForShipment();
            
        } catch (err) {
            console.error('Error uploading document:', err);
            showDocumentsMessage('Failed to upload document: ' + err.message, 'error');
        }
    }

    window.viewDocument = function(btn) {
        const card = btn.closest('.document-card');
        window.open(card.dataset.fileUrl, '_blank');
    };

    window.downloadDocument = function(btn) {
        const card = btn.closest('.document-card');
        const a = document.createElement('a');
        a.href = card.dataset.fileUrl;
        a.download = card.dataset.fileUrl.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    window.deleteDocument = async function(btn) {
        if (!confirm('Are you sure you want to delete this document?')) {
            return;
        }
        
        const card = btn.closest('.document-card');
        const docId = card.dataset.docId;
        const fileUrl = card.dataset.fileUrl;
        
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
            
            showDocumentsMessage('Document deleted successfully', 'success');
            
            // Reload required docs checklist and documents list
            await loadRequiredDocumentsChecklist();
            await loadDocumentsForShipment();
            
        } catch (err) {
            console.error('Error deleting document:', err);
            showDocumentsMessage('Failed to delete document: ' + err.message, 'error');
        }
    };

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

    function setupBillsCalculations() {
        const inputs = [
            'ip_charges', 'bank_contract_opening_charges', 'shipping_guarantee', 'fbr_duty',
            'forwarder_charges', 'clearing_charges', 'local_transporter', 'port_charges',
            'final_payment_charges', 'final_payment', 'qty'
        ];

        const outputFields = ['total', 'total_cost', 'oh_perc', 'per_unit_rate'];

        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? (parseFloat(el.value) || 0) : 0;
        };

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = isFinite(val) ? val.toFixed(2) : 0;
        };

        const calculate = () => {
            const ip = getVal('ip_charges');
            const bank = getVal('bank_contract_opening_charges');
            const shipping = getVal('shipping_guarantee');
            const fbr = getVal('fbr_duty');
            const forwarder = getVal('forwarder_charges');
            const clearing = getVal('clearing_charges');
            const local = getVal('local_transporter');
            const port = getVal('port_charges');
            const finalCharges = getVal('final_payment_charges');
            
            const finalPayment = getVal('final_payment');
            const qty = getVal('qty');

            // 1. Total
            const total = ip + bank + shipping + fbr + forwarder + clearing + local + port + finalCharges;
            setVal('total', total);

            // 2. Total Cost
            const totalCost = total + finalPayment;
            setVal('total_cost', totalCost);

            // 3. OH % (Ratio as per request)
            const ohPerc = finalPayment !== 0 ? (total / finalPayment) : 0;
            setVal('oh_perc', ohPerc);

            // 4. Per Unit Rate
            const perUnitRate = qty !== 0 ? (totalCost / qty) : 0;
            setVal('per_unit_rate', perUnitRate);
        };

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', calculate);
            }
        });

        outputFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.readOnly = true;
        });
        
        calculate();
    }
  
