const MGT = {
    jobs: [],
    customers: [],
    jobDetails: {},
    activeJobId: null,
    adminTab: 'jobs',
    linkingJobDbId: null,
    linkingEmail: null,
    sidebarSearch: '',
    sidebarFilter: 'all',
    showArchived: false,
    
    // Constants copied from original
    STAGES: [
        {key:'intake',label:'Intake'},{key:'teardown',label:'Teardown'},{key:'inspect',label:'Inspection'},
        {key:'parts',label:'Parts'},{key:'rebuild',label:'Rebuild'},{key:'spintest',label:'Spin Test'},{key:'painting',label:'Painting'},{key:'complete',label:'Complete'}
    ],
    CHECKLIST_TEMPLATE: [
        { group:'Intake & Teardown', items:['Photograph gearbox exterior & nameplate','Record serial number, ratio, mounting position','Drain and inspect oil (colour, particles, water)','Remove couplings and external components','Disassemble gearbox, label all parts','Clean all components (ultrasonic or solvent)'] },
        { group:'Inspection', items:['Inspect gear teeth for pitting, wear, scoring','Measure gear backlash and tooth contact','Inspect all bearings (replace as standard)','Inspect shafts for wear, cracks, run-out','Inspect seals, gaskets, and O-rings','Check housing for cracks or distortion','Document all findings with photos'] },
        { group:'Parts & Ordering', items:['Create parts list from inspection findings','Source bearings, seals, and consumables','Confirm customer approval for parts cost','Parts received and verified against order'] },
        { group:'Rebuild', items:['Apply correct fits/tolerances on shaft assemblies','Heat-fit bearings using induction heater','Install gears and verify tooth contact','Set correct bearing preload / end-float','Install seals and gaskets','Torque all fasteners to spec (record values)','Fill with correct grade and volume of oil'] },
        { group:'Spin Test', items:['No-load run-in (document start-up temps)','Vibration analysis — check against baseline','Check for oil leaks under operating temp','Load test if test rig available','Final photography of completed unit'] },
        { group:'Painting', items:['Surface preparation and masking','Apply primer coat','Apply finish coat — colour match confirmed','Inspect paint finish, touch up as required','Apply ID labels and nameplate','Complete repair report / documentation','Customer sign-off obtained'] }
    ],
    CHECKLIST_STAGE_MAP: [{req:0,adv:2},{req:2,adv:3},{req:3,adv:4},{req:4,adv:5},{req:5,adv:6},{req:6,adv:7}],

    init() {
        if (!window.mgtData) return;
        this.renderBaseHTML();
        this.loadData().then(() => {
            this.enterApp();
        });
    },

    async loadData() {
        try {
            const jobsRes = await fetch(mgtData.restUrl + 'jobs', { headers: { 'X-WP-Nonce': mgtData.nonce } });
            if (jobsRes.ok) this.jobs = await jobsRes.json();

            if (mgtData.userRole === 'admin') {
                const custRes = await fetch(mgtData.restUrl + 'customers', { headers: { 'X-WP-Nonce': mgtData.nonce } });
                if (custRes.ok) this.customers = await custRes.json();
            }
        } catch (e) {
            console.error("MGT Load Data Error", e);
            this.showToast('error', 'Error', 'Failed to load data from server.');
        }
    },

    async api(endpoint, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'X-WP-Nonce': mgtData.nonce,
                'Content-Type': 'application/json'
            }
        };
        if (body) options.body = JSON.stringify(body);
        
        try {
            const res = await fetch(mgtData.restUrl + endpoint, options);
            if (!res.ok) throw new Error('API request failed');
            return await res.json();
        } catch (e) {
            this.showToast('error', 'Error', e.message);
            throw e;
        }
    },

    renderBaseHTML() {
        const root = document.getElementById('mgt-root');
        root.innerHTML = `
            <!-- TOP BAR -->
            <div class="topbar">
                <div class="logo">
                    <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.8rem;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;line-height:1;margin-bottom:.6rem;">MAYDAY <span style="color:#e07a35;">GEARBOX REPAIR</span></div>
                </div>
                <div class="topbar-right">
                    <div id="adminStats" style="display:none;gap:.75rem">
                        <div class="stat-pill">Active: <strong id="stat-active">0</strong></div>
                        <div class="stat-pill">Complete: <strong id="stat-complete">0</strong></div>
                    </div>
                    <div class="user-pill" id="userPill">—</div>
                    <a class="btn-logout" id="btnWpAdmin" style="display:none; margin-right:5px;" href="${mgtData.adminUrl}">WP Admin</a>
                    <a class="btn-logout" href="${mgtData.logoutUrl}">Sign Out</a>
                </div>
            </div>

            <!-- ADMIN TAB BAR -->
            <div class="tab-bar" id="adminTabBar" style="display:none">
                <button class="tab-btn active" onclick="MGT.switchAdminTab('jobs')">Work Orders</button>
                <button class="tab-btn" onclick="MGT.switchAdminTab('customers')">Customer Accounts</button>
                <button class="tab-btn" onclick="MGT.switchAdminTab('settings')">Email Settings</button>
            </div>

            <!-- ADMIN: JOBS VIEW -->
            <div id="adminJobsView" style="display:none">
                <div class="layout">
                    <aside class="sidebar">
                        <div class="sidebar-header">
                            <span class="sidebar-label">Work Orders</span>
                            <button class="btn-add" onclick="MGT.openNewJobModal()">+ New Job</button>
                        </div>
                        <div class="sidebar-filters">
                            <input type="text" class="sidebar-search" id="sidebarSearch" placeholder="Search WO, description, customer..." oninput="MGT.sidebarSearch=this.value;MGT.renderSidebar()"/>
                            <select class="sidebar-stage-filter" id="sidebarStageFilter" onchange="MGT.sidebarFilter=this.value;MGT.renderSidebar()">
                                <option value="all">All Stages</option>
                                ${this.STAGES.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}
                            </select>
                            <div class="sidebar-toggle-row">
                                <label><input type="checkbox" id="sidebarShowArchived" onchange="MGT.showArchived=this.checked;MGT.renderSidebar()" style="accent-color:var(--green);"/> Show Archived</label>
                            </div>
                        </div>
                        <div class="job-list" id="jobList"></div>
                    </aside>
                    <main class="main" id="mainPanel">
                        <div class="empty-state"><div class="empty-icon">⚙</div><p>Select a work order or create a new one</p></div>
                    </main>
                </div>
            </div>

            <!-- ADMIN: CUSTOMERS VIEW -->
            <div id="adminCustomersView" style="display:none; padding:1.5rem">
                <div class="user-table-wrap">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:.75rem;">
                        <div>
                            <div class="section-heading" style="margin-bottom:.3rem">Gearbox Customers</div>
                            <div style="font-size:.75rem;color:var(--muted)">Manage your clients and their linked jobs.</div>
                        </div>
                        <button class="btn btn-primary" onclick="MGT.openModal('inviteModal')" style="white-space:nowrap;">✉ Invite Customer</button>
                    </div>
                    <table class="user-table" id="customerTable">
                        <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Linked Jobs</th><th>Actions</th></tr></thead>
                        <tbody id="customerTableBody"></tbody>
                    </table>

                    <div style="margin-top:3rem;">
                        <div class="section-heading" style="margin-bottom:.3rem">Shop Staff & Admins</div>
                        <table class="user-table" id="adminTable">
                            <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Role</th></tr></thead>
                            <tbody id="adminTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ADMIN: SETTINGS VIEW -->
            <div id="adminSettingsView" style="display:none; padding:1.5rem">
                <div class="user-table-wrap" style="max-width:600px;">
                    <div class="section-heading" style="margin-bottom:.3rem">Email Notifications</div>
                    <div style="font-size:.75rem;color:var(--muted);margin-bottom:1.25rem;">Toggle which stages trigger an automatic email to linked customers.</div>
                    <div id="emailSettingsCheckboxes" style="display:flex; flex-direction:column; gap:10px;"></div>
                    <button class="btn btn-primary" style="margin-top:1.5rem;" onclick="MGT.saveEmailSettings()">Save Settings</button>
                </div>
            </div>

            <!-- CUSTOMER VIEW -->
            <div id="customerView" style="display:none">
                <div class="customer-main" id="customerMainContent"></div>
            </div>
            
            <div class="toast-wrap" id="toastWrap"></div>

            <!-- MODALS -->
            <div class="modal-overlay" id="newJobModal">
                <div class="modal">
                    <div class="modal-title">New Work Order</div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Job / WO Number</label><input class="form-input" id="f-id" readonly disabled style="color:var(--muted);background:var(--surface2);" placeholder="Loading..."/></div>
                        <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="f-priority"><option value="Low">Low</option><option value="Normal" selected>Normal</option><option value="High">High</option></select></div>
                    </div>
                    <div class="form-row full"><div class="form-group"><label class="form-label">Gearbox Description</label><input class="form-input" id="f-desc" placeholder="e.g. Flender H3SH helical, 250kW"/></div></div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Customer / Asset (label)</label><input class="form-input" id="f-customer" placeholder="e.g. Acme Plant #3"/></div>
                        <div class="form-group"><label class="form-label">Assigned Tech</label><input class="form-input" id="f-tech" placeholder="e.g. J. Martinez"/></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Date In</label><input class="form-input" id="f-date" type="date"/></div>
                        <div class="form-group"><label class="form-label">Est. Completion</label><input class="form-input" id="f-eta" type="date"/></div>
                    </div>
                    <div class="form-row full"><div class="form-group"><label class="form-label">Failure Description</label><input class="form-input" id="f-failure" placeholder="e.g. Bearing failure, excessive vibration"/></div></div>
                    <div class="form-row full">
                        <div class="form-group">
                            <label class="form-label">Link to Customer <span style="color:var(--muted);font-size:.6rem;">(optional)</span></label>
                            <input type="text" class="form-input" id="f-customer-search" placeholder="Search customer by name or email..." onkeyup="MGT.filterNewJobCustomer()" style="margin-bottom:.4rem;"/>
                            <div id="f-customer-list" style="background:var(--bg);border:1px solid var(--border2);max-height:160px;overflow-y:auto;display:none;"></div>
                            <input type="hidden" id="f-customer-id" value=""/>
                            <div id="f-customer-selected" style="font-size:.75rem;color:var(--green);margin-top:.3rem;"></div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn" onclick="MGT.closeModal('newJobModal')">Cancel</button>
                        <button class="btn btn-primary" onclick="MGT.createJob()">Create Work Order</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="inviteModal">
                <div class="modal">
                    <div class="modal-title">✉ Invite Customer</div>
                    <div style="font-size:.78rem;color:var(--muted);margin-bottom:1rem;line-height:1.6;">Send an invitation email asking the customer to login to the Mayday Gearbox Repair portal.</div>
                    <div class="form-group"><label class="form-label">Customer Name</label><input class="form-input" id="inv-name"/></div>
                    <div class="form-group"><label class="form-label">Customer Email</label><input class="form-input" id="inv-email" type="email"/></div>
                    <div class="form-group"><label class="form-label">Work Order Reference</label><input class="form-input" id="inv-job"/></div>
                    <div class="form-group"><label class="form-label">Personal Message</label><textarea class="form-input" id="inv-message" rows="3" style="resize:vertical;"></textarea></div>
                    <div class="modal-actions">
                        <button class="btn" onclick="MGT.closeModal('inviteModal')">Cancel</button>
                        <button class="btn btn-primary" onclick="MGT.sendInvite()">Send Invitation →</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="linkCustomersModal">
                <div class="modal" style="max-width:580px;">
                    <div class="modal-title">Link Customers to Work Order</div>
                    <div style="font-size:.78rem;color:var(--muted);margin-bottom:1rem">Work Order: <strong id="linkJobTitle" style="color:var(--text)"></strong></div>
                    <div class="form-row full">
                    <div class="form-group">
                        <input type="text" class="form-input" id="linkCustomerSearch" placeholder="Search by name or email..." onkeyup="MGT.filterLinkCustomers()" style="margin-bottom:.5rem;"/>
                        <label class="form-label">Select Customers to Link</label>
                        <div id="linkCustomerCheckboxes" style="background:var(--bg);border:1px solid var(--border2);padding:.75rem;max-height:280px;overflow-y:auto;"></div>
                    </div>
                    </div>
                    <div class="modal-actions">
                    <button class="btn" onclick="MGT.closeModal('linkCustomersModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="MGT.saveLinkCustomers()">Save Links</button>
                    </div>
                </div>
            </div>
            
            <div class="modal-overlay" id="linkUserJobsModal">
                <div class="modal" style="max-width:580px;">
                    <div class="modal-title">Link Work Orders to Customer</div>
                    <div style="font-size:.78rem;color:var(--muted);margin-bottom:1rem">Customer: <strong id="linkUserJobsTitle" style="color:var(--text)"></strong></div>
                    <div class="form-row full">
                    <div class="form-group">
                        <label class="form-label">Select Work Orders to Link</label>
                        <div id="linkUserJobsCheckboxes" style="background:var(--bg);border:1px solid var(--border2);padding:.75rem;max-height:280px;overflow-y:auto;"></div>
                    </div>
                    </div>
                    <div class="modal-actions">
                    <button class="btn" onclick="MGT.closeModal('linkUserJobsModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="MGT.saveLinkUserJobs()">Save Links</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="editNoteModal">
                <div class="modal">
                    <div class="modal-title">Edit Update</div>
                    <input type="hidden" id="editNoteIndex" value=""/>
                    <div class="form-group"><label class="form-label">Update Text</label><textarea class="form-input" id="editNoteText" rows="3" style="resize:vertical;"></textarea></div>
                    <div class="form-group">
                        <label class="form-label">Attachments</label>
                        <div id="editNoteAttachments" style="display:flex;flex-direction:column;gap:.3rem;"></div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn" onclick="MGT.closeModal('editNoteModal')">Cancel</button>
                        <button class="btn btn-primary" onclick="MGT.saveEditNote()">Save Changes</button>
                    </div>
                </div>
            </div>
            
            <div id="mgtLightbox" class="mgt-lightbox" onclick="if(event.target===this)MGT.closeLightbox()">
                <button class="lb-close" onclick="MGT.closeLightbox()">&times;</button>
                <button class="lb-prev" onclick="MGT.lightboxNav(-1)">&#8249;</button>
                <button class="lb-next" onclick="MGT.lightboxNav(1)">&#8250;</button>
                <div class="lb-content" id="lbContent"></div>
                <div class="lb-caption" id="lbCaption"></div>
            </div>
        `;
    },

    enterApp() {
        document.getElementById('userPill').textContent = mgtData.userRole === 'admin' ? '⚙ Admin' : mgtData.userEmail;
        if (mgtData.userRole === 'admin') {
            document.getElementById('adminStats').style.display = 'flex';
            document.getElementById('adminTabBar').style.display = 'flex';
            // WP Admin button only for actual administrators, not shop managers
            if (mgtData.isAdministrator) {
                document.getElementById('btnWpAdmin').style.display = 'inline-block';
            }
            this.switchAdminTab('jobs');
        } else {
            document.getElementById('customerView').style.display = 'block';
            this.renderCustomerView();
        }
    },

    async switchAdminTab(tab) {
        this.adminTab = tab;
        // Reset mobile detail view when switching tabs
        document.getElementById('mgt-root').classList.remove('mobile-detail');
        document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', 
            (i === 0 && tab === 'jobs') || (i === 1 && tab === 'customers') || (i === 2 && tab === 'settings')));
        document.getElementById('adminJobsView').style.display = tab === 'jobs' ? 'block' : 'none';
        document.getElementById('adminCustomersView').style.display = tab === 'customers' ? 'block' : 'none';
        document.getElementById('adminSettingsView').style.display = tab === 'settings' ? 'block' : 'none';
        if (tab === 'customers') this.renderCustomerTable();
        if (tab === 'jobs') {
            this.renderSidebar(); this.updateStats();
            if (this.activeJobId) {
                if (!this.jobDetails[this.activeJobId]) await this.loadJobDetail(this.activeJobId);
                this.renderDetail();
            }
        }
        if (tab === 'settings') this.loadEmailSettings();
    },

    // ── HELPERS ──
    esc(str) {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    },
    fmtDate(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    },
    jobProgress(job) {
        let total=0, done=0;
        if (!job.checklist) return 0;
        job.checklist.forEach(g => g.items.forEach(i => { total++; if (i.done) done++; }));
        return total === 0 ? 0 : Math.round((done/total)*100);
    },
    badgeClass(job) {
        const m = {intake:'badge-intake', teardown:'badge-teardown', inspect:'badge-parts', parts:'badge-parts', rebuild:'badge-rebuild', spintest:'badge-testing', painting:'badge-testing', complete:'badge-complete'};
        return m[this.STAGES[Math.min(job.stageIndex, this.STAGES.length-1)].key] || 'badge-intake';
    },
    openModal(id) { document.getElementById(id).classList.add('open'); },
    async openNewJobModal() {
        this.openModal('newJobModal');
        const idInput = document.getElementById('f-id');
        if (idInput) {
            idInput.value = 'Loading...';
            try {
                const res = await this.api('jobs/next-id', 'GET');
                idInput.value = res.next_id + ' (Auto)';
            } catch (e) {
                idInput.value = 'Auto-generated';
            }
        }
    },
    closeModal(id) { document.getElementById(id).classList.remove('open'); },
    showToast(type, title, msg) {
        const wrap = document.getElementById('toastWrap');
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<div><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
        wrap.appendChild(t);
        setTimeout(() => {
            t.classList.add('removing');
            setTimeout(() => t.remove(), 300);
        }, 4000);
    },

    // ── JOBS UI ──
    renderSidebar() {
        const list = document.getElementById('jobList');
        if (!list) return;
        if (this.jobs.length === 0) { list.innerHTML = '<div style="padding:1.5rem 1rem;color:var(--muted);font-size:.75rem;text-align:center">No work orders yet</div>'; return; }
        
        // Apply filters
        let filtered = this.jobs;
        if (!this.showArchived) {
            filtered = filtered.filter(j => !j.archived);
        }
        if (this.sidebarFilter !== 'all') {
            const stageIdx = this.STAGES.findIndex(s => s.key === this.sidebarFilter);
            if (stageIdx >= 0) filtered = filtered.filter(j => j.stageIndex === stageIdx);
        }
        if (this.sidebarSearch) {
            const q = this.sidebarSearch.toLowerCase();
            filtered = filtered.filter(j => 
                (j.id || '').toLowerCase().includes(q) || 
                (j.desc || '').toLowerCase().includes(q) || 
                (j.customer || '').toLowerCase().includes(q) ||
                (j.tech || '').toLowerCase().includes(q)
            );
        }
        if (filtered.length === 0) { list.innerHTML = '<div style="padding:1.5rem 1rem;color:var(--muted);font-size:.75rem;text-align:center">No matching work orders</div>'; return; }

        list.innerHTML = filtered.map(j => {
            const pct = j.progress || 0;
            const stageName = this.STAGES[Math.min(j.stageIndex, this.STAGES.length-1)].label;
            const archivedBadge = j.archived ? '<span class="badge-archived">Archived</span>' : '';
            return `<div class="job-item ${j.db_id === this.activeJobId ? 'active' : ''} ${j.archived ? 'archived' : ''}" onclick="MGT.selectJob(${j.db_id})">
                <div class="job-item-top"><div class="job-id">${this.esc(j.id)}</div><div class="status-badge ${this.badgeClass(j)}">${stageName}</div>${archivedBadge}</div>
                <div class="job-desc">${this.esc(j.desc)}</div>
                <div class="job-progress-bar"><div class="job-progress-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
    },
    
    updateStats() {
        document.getElementById('stat-active').textContent = this.jobs.filter(j => j.stageIndex < this.STAGES.length-1).length;
        document.getElementById('stat-complete').textContent = this.jobs.filter(j => j.stageIndex >= this.STAGES.length-1).length;
    },

    async selectJob(db_id) {
        this.activeJobId = db_id;
        this.renderSidebar();
        document.getElementById('mgt-root').classList.add('mobile-detail');
        // Show loading if detail not cached
        const main = document.getElementById('mainPanel');
        if (main && !this.jobDetails[db_id]) {
            main.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading work order...</p></div>';
        }
        await this.loadJobDetail(db_id);
        if (this.activeJobId === db_id) this.renderDetail();
    },

    backToList() {
        document.getElementById('mgt-root').classList.remove('mobile-detail');
    },

    // ── LAZY LOADING & CACHE ──
    async loadJobDetail(db_id) {
        if (this.jobDetails[db_id]) return this.jobDetails[db_id];
        const detail = await this.api(`jobs/${db_id}`, 'GET');
        this.jobDetails[db_id] = detail;
        return detail;
    },

    getActiveJob() {
        return this.jobDetails[this.activeJobId] || null;
    },

    syncToList(db_id) {
        const detail = this.jobDetails[db_id];
        if (!detail) return;
        const listJob = this.jobs.find(j => j.db_id === db_id);
        if (!listJob) return;
        listJob.stageIndex = detail.stageIndex;
        listJob.progress = this.jobProgress(detail);
        listJob.eta = detail.eta;
        listJob.failure = detail.failure;
        listJob.linkedCustomers = detail.linkedCustomers;
        listJob.archived = detail.archived;
    },

    async createJob() {
        const desc = document.getElementById('f-desc').value.trim();
        const customer = document.getElementById('f-customer').value.trim();
        const tech = document.getElementById('f-tech').value.trim();
        const priority = document.getElementById('f-priority').value;
        const dateIn = document.getElementById('f-date').value;
        const eta = document.getElementById('f-eta').value;
        const failure = document.getElementById('f-failure').value.trim();
        const linkedCustomerId = document.getElementById('f-customer-id') ? parseInt(document.getElementById('f-customer-id').value) || null : null;

        if (!desc || !tech || !priority || !dateIn || !eta) {
            this.showToast('error', 'Required Fields', 'Please fill in all required fields to create a work order.');
            return;
        }
        
        const checklist = this.CHECKLIST_TEMPLATE.map(g => ({
            group: g.group, 
            items: g.items.map(label => ({label, done:false, tech:'', ts:null}))
        }));
        
        const payload = {
            desc, customer, tech, priority, dateIn, eta, failure, checklist,
            linkedCustomers: linkedCustomerId ? [linkedCustomerId] : []
        };

        const newJob = await this.api('jobs', 'POST', payload);
        // Cache the full detail and add light version to list
        this.jobDetails[newJob.db_id] = newJob;
        this.jobs.unshift({
            db_id: newJob.db_id, id: newJob.id, desc: newJob.desc, customer: newJob.customer,
            tech: newJob.tech, priority: newJob.priority, dateIn: newJob.dateIn, eta: newJob.eta,
            stageIndex: newJob.stageIndex, progress: 0, linkedCustomers: newJob.linkedCustomers,
            failure: newJob.failure
        });
        this.closeModal('newJobModal');
        // Clear customer search fields
        if (document.getElementById('f-customer-search')) document.getElementById('f-customer-search').value = '';
        if (document.getElementById('f-customer-id')) document.getElementById('f-customer-id').value = '';
        if (document.getElementById('f-customer-selected')) document.getElementById('f-customer-selected').textContent = '';
        this.renderSidebar();
        this.updateStats();
        this.selectJob(newJob.db_id);
        this.showToast('success', 'Created', 'Work order created successfully.');
    },

    filterNewJobCustomer() {
        const query = document.getElementById('f-customer-search').value.toLowerCase();
        const list = document.getElementById('f-customer-list');
        if (!query) { list.style.display = 'none'; return; }
        const matches = this.customers.filter(c => c.role === 'customer' && 
            (c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query)));
        if (matches.length === 0) { list.style.display = 'none'; return; }
        list.style.display = 'block';
        list.innerHTML = matches.map(c => `
            <div onclick="MGT.selectNewJobCustomer(${c.id}, '${this.esc(c.name || c.email)}')" 
                 style="padding:.5rem .75rem;cursor:pointer;font-size:.82rem;border-bottom:1px solid var(--border);">
                <strong>${this.esc(c.name)}</strong> <span style="color:var(--muted)">${this.esc(c.email)}</span>
            </div>`).join('');
    },

    selectNewJobCustomer(id, label) {
        document.getElementById('f-customer-id').value = id;
        document.getElementById('f-customer-search').value = '';
        document.getElementById('f-customer-list').style.display = 'none';
        document.getElementById('f-customer-selected').textContent = '✓ Linked: ' + label;
    },

    renderDetail() {
        const main = document.getElementById('mainPanel');
        if (!main) return;
        const job = this.getActiveJob();
        if (!job) { main.innerHTML = '<div class="empty-state"><div class="empty-icon">⚙</div><p>Select a work order</p></div>'; return; }
        
        const backBtn = '<button class="mobile-back-btn" onclick="MGT.backToList()">‹ Back to List</button>';
        
        const pct = this.jobProgress(job);

        const stagesHTML = this.STAGES.map((s,i) => `
            <div class="stage ${i < job.stageIndex ? 'done' : ''} ${i === job.stageIndex ? 'current' : ''}">
            ${i < job.stageIndex ? '<span class="stage-check">✔</span>' : ''}
            <div class="stage-num">${String(i+1).padStart(2,'0')}</div>
            <div class="stage-name">${s.label}</div>
            </div>`).join('');

        const checklistHTML = (job.checklist || []).map((g, gi) => {
            const isGroupEnabled = job.stageIndex >= MGT.CHECKLIST_STAGE_MAP[gi].req;
            return `
            <div class="checklist-group" style="${isGroupEnabled ? '' : 'opacity:0.5; pointer-events:none;'}">
            <div class="checklist-group-title">${this.esc(g.group)} · ${g.items.filter(i=>i.done).length}/${g.items.length}</div>
            ${g.items.map((item, ii) => `
                <div class="check-item">
                <div class="check-box ${item.done ? 'checked' : ''}" onclick="MGT.toggleCheck(${gi},${ii})">${item.done ? '✔' : ''}</div>
                <div class="check-label ${item.done ? 'checked-label' : ''}">${this.esc(item.label)}</div>
                ${item.done && item.ts ? `<span class="check-tech">${this.esc(item.tech)} ${this.fmtDate(item.ts)}</span>` : ''}
                </div>`).join('')}
            </div>`;
        }).join('');

        const updatesHTML = (job.notes || []).length === 0
            ? '<div style="color:var(--muted2);font-size:.78rem;padding:.5rem">No updates yet.</div>'
            : [...job.notes].reverse().map((n, ni) => {
                const galleryId = `gallery_${ni}`;
            const realLen = (job.notes || []).length;
            const attHTML = this.renderGallery(n.attachments || [], galleryId);
                const realIndex = realLen - 1 - ni;
                const noteActions = `<span class="note-actions">
                    <button class="note-action-btn" onclick="MGT.editNote(${realIndex})">✏ Edit</button>
                    <button class="note-action-btn delete" onclick="MGT.deleteNote(${realIndex})">🗑</button>
                </span>`;
                return `
            <div style="padding:.65rem 0; border-bottom:1px solid var(--border);">
                <div style="font-size:.65rem; color:var(--muted); margin-bottom:.3rem; font-family:'Barlow Condensed',sans-serif; letter-spacing:.06em;">${this.esc(n.tech || 'Tech')} &middot; ${this.fmtDate(n.ts)} ${n.customerVisible ? '<span style="font-size:.58rem; padding:.1rem .4rem; background:var(--blue-dim); color:var(--blue); border:1px solid var(--blue); margin-left:.4rem;">Visible to customer</span>' : '<span style="font-size:.58rem; padding:.1rem .4rem; background:var(--surface2); color:var(--muted); border:1px solid var(--border); margin-left:.4rem;">Internal</span>'}
                ${noteActions}
                </div>
                <div style="font-size:.8rem;line-height:1.5;">${this.esc(n.text)}</div>
                ${attHTML}
            </div>`;
            }).join('');

        const p = job.priority || 'Normal';
        const priorityColor = (p === 'Rush' || p === 'High') ? 'var(--red)' : (p === 'Urgent' ? 'var(--yellow)' : 'var(--muted)');
        const prioritySelect = `
            <select onchange="MGT.updateJobField('priority', this.value)" style="background:var(--surface2);border:1px solid var(--border);color:${priorityColor};font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:.85rem;padding:.1rem .3rem;outline:none;border-radius:3px;cursor:pointer;">
                <option value="Low" ${p==='Low'?'selected':''} style="background:var(--surface2);color:var(--text)">Low</option>
                <option value="Normal" ${p==='Normal'?'selected':''} style="background:var(--surface2);color:var(--text)">Normal</option>
                <option value="High" ${p==='High'?'selected':''} style="background:var(--surface2);color:var(--text)">High</option>
            </select>
        `;

        main.innerHTML = `${backBtn}<div class="job-detail">
            <div class="detail-header">
                <div>
                    <div class="detail-id">Work Order &middot; ${this.esc(job.id)} &middot; ${prioritySelect}</div>
                    <div class="detail-title">${this.esc(job.desc)}</div>
                    <div style="margin-top:.5rem;font-size:.8rem;color:var(--muted)">
                        ${job.customer ? this.esc(job.customer) + ' &middot; ' : ''}${job.tech ? 'Tech: ' + this.esc(job.tech) : ''} &middot; Progress: <strong style="color:var(--green)">${pct}%</strong>
                    </div>
                    ${(() => {
                        const linked = (job.linkedCustomers || []).map(cid => {
                            const c = this.customers.find(x => x.id === cid);
                            return c ? `<span class="linked-job-tag" style="margin:.15rem .1rem;">${this.esc(c.name || c.email)}</span>` : '';
                        }).join('');
                        return linked ? `<div style="margin-top:.4rem;font-size:.72rem;color:var(--muted);">Linked: ${linked}</div>` : '';
                    })()}
                </div>
                <div class="detail-actions">
                    <button class="btn" onclick="MGT.openLinkCustomersModal()">🔗 Link Customers</button>
                    ${job.stageIndex >= this.STAGES.length - 1 ? `<button class="btn" onclick="MGT.toggleArchive(${job.db_id})">${job.archived ? '📂 Unarchive' : '📦 Archive'}</button>` : ''}
                    <button class="btn btn-danger" onclick="MGT.deleteJob(${job.db_id})">Delete</button>
                </div>
            </div>
            
            <div class="info-grid">
                <div class="info-cell"><div class="info-label">Date In</div><div class="info-value">${job.dateIn || '—'}</div></div>
                <div class="info-cell">
                    <div class="info-label">Est. Complete</div>
                    <div style="display:flex;align-items:center;gap:.4rem;margin-top:.3rem;">
                        <input type="date" id="etaInput" value="${job.eta || ''}" style="flex:1;background:var(--surface2);border:1px solid var(--border2);color:var(--text);font-family:'Barlow',sans-serif;font-size:.82rem;padding:.35rem .5rem;outline:none;min-width:0;"/>
                        <button class="btn btn-primary" style="padding:.3rem .6rem;font-size:.65rem;white-space:nowrap;" onclick="MGT.saveEta()">Save</button>
                    </div>
                </div>
                <div class="info-cell"><div class="info-label">Current Stage</div><div class="info-value" style="color:var(--yellow)">${this.STAGES[Math.min(job.stageIndex, this.STAGES.length-1)].label}</div></div>
                <div class="info-cell"><div class="info-label">Tasks Done</div><div class="info-value">${pct}%</div></div>
                <div class="info-cell" style="grid-column:span 2">
                    <div class="info-label">Failure / Reason for Repair</div>
                    <div style="font-size:.82rem;color:var(--text);line-height:1.5;margin-top:.3rem;padding:.35rem 0;">${this.esc(job.failure || '—')}</div>
                </div>
            </div>

            <div class="pipeline-wrap">
                <div class="section-heading">Repair Stage</div>
                <div class="pipeline">${stagesHTML}</div>
            </div>
            <div class="checklist-wrap">
                <div class="section-heading">Task Checklist</div>${checklistHTML}
            </div>

            <div class="notes-wrap">
                <div class="section-heading">Updates & Shop Log</div>
                <div style="background:var(--surface); border:1px solid var(--border); max-height:400px; overflow-y:auto; padding:.75rem; margin-bottom:.75rem;">${updatesHTML}</div>
                <div style="background:var(--surface); border:1px solid var(--border); padding:.85rem; margin-top:.5rem;">
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:.72rem; letter-spacing:.12em; text-transform:uppercase; color:var(--green); margin-bottom:.6rem;">Post Update</div>
                    <textarea id="updateText" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border2);color:var(--text);padding:.55rem .75rem;font-family:'Barlow',sans-serif;font-size:.85rem;outline:none;resize:vertical;margin-bottom:.6rem;" placeholder="Write an update note..."></textarea>
                    <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                        <input type="file" multiple id="updateFileInput" style="display:none" onchange="MGT.handleFileSelect(event)"/>
                        <button class="btn" style="font-size:.75rem;padding:.35rem .7rem;" onclick="document.getElementById('updateFileInput').click()">📎 Attach Files <span style='font-size:.6rem;color:var(--muted);'>(max 10 MB)</span></button>
                    </div>
                    <div id="uploadProgressArea" style="margin-top:.5rem;"></div>
                    <div style="display:flex;align-items:center;gap:.75rem;margin-top:.6rem;justify-content:space-between;">
                        <label style="display:flex;align-items:center;gap:.35rem;font-size:.72rem;color:var(--muted);cursor:pointer;"><input type="checkbox" id="updateVisible"/> Visible to Customer (sends email)</label>
                        <button class="btn btn-primary" id="btnPostUpdate" style="font-size:.78rem;padding:.45rem 1.2rem;" onclick="MGT.postUpdate()">Post Update</button>
                    </div>
                </div>
            </div>
        </div>`;
    },

    async setStage(i) {
        const job = this.getActiveJob();
        if (!job || job.stageIndex === i) return;
        
        job.stageIndex = i;
        this.syncToList(job.db_id);
        this.renderSidebar();
        this.updateStats();
        this.renderDetail();

        await this.api(`jobs/${job.db_id}`, 'PUT', { stageIndex: i });
        this.showToast('info', 'Stage Updated', `Moved to ${this.STAGES[i].label}`);
    },

    async updateJobField(field, value) {
        const job = this.getActiveJob();
        if (!job) return;
        job[field] = value.trim();
        this.syncToList(job.db_id);
        await this.api(`jobs/${job.db_id}`, 'PUT', { [field]: job[field] });
    },

    async saveEta() {
        const val = document.getElementById('etaInput').value;
        await this.updateJobField('eta', val);
        this.showToast('success', 'Saved', 'Estimated completion date updated.');
    },

    async toggleCheck(gi, ii) {
        const job = this.getActiveJob();
        if (!job) return;
        const isGroupEnabled = job.stageIndex >= MGT.CHECKLIST_STAGE_MAP[gi].req;
        if (!isGroupEnabled) return;

        const item = job.checklist[gi].items[ii];
        item.done = !item.done;
        item.ts = item.done ? Date.now() : null;
        item.tech = item.done ? (job.tech || 'Tech') : '';

        // Auto-advance: first check in group 0 moves Intake(0) → Teardown(1)
        if (gi === 0 && item.done && job.stageIndex === 0) {
            job.stageIndex = 1;
            this.showToast('info', 'Stage Auto-Updated', `Moved to ${this.STAGES[1].label}`);
        }
        
        // Auto-advance: completing all items in a group advances to the next stage
        const allDone = job.checklist[gi].items.every(i => i.done);
        if (allDone && job.stageIndex < MGT.CHECKLIST_STAGE_MAP[gi].adv) {
            job.stageIndex = MGT.CHECKLIST_STAGE_MAP[gi].adv;
            this.showToast('info', 'Stage Auto-Updated', `Moved to ${this.STAGES[job.stageIndex].label}`);
        }
        
        this.syncToList(job.db_id);
        this.renderDetail();
        this.renderSidebar();
        this.updateStats();
        await this.api(`jobs/${job.db_id}`, 'PUT', { checklist: job.checklist, stageIndex: job.stageIndex });
    },

    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
    pendingFiles: [],
    uploadedAttachments: [],
    uploadsInProgress: 0,

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        if (!files.length) return;
        const job = this.getActiveJob();
        if (!job) return;

        // Validate sizes
        const rejected = files.filter(f => f.size > this.MAX_FILE_SIZE);
        const accepted = files.filter(f => f.size <= this.MAX_FILE_SIZE);
        if (rejected.length > 0) {
            this.showToast('error', 'Too Large', `${rejected.map(f=>f.name).join(', ')} exceed 10 MB limit.`);
        }
        if (accepted.length === 0) return;

        // Disable post button
        const btn = document.getElementById('btnPostUpdate');
        if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

        // Create progress UI
        const area = document.getElementById('uploadProgressArea');

        accepted.forEach((file, idx) => {
            const id = `upload_${Date.now()}_${idx}`;
            const sizeMB = (file.size / 1024 / 1024).toFixed(1);
            area.insertAdjacentHTML('beforeend', `
                <div id="${id}" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;font-size:.72rem;">
                    <span style="min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);">${this.esc(file.name)}</span>
                    <span style="color:var(--muted);">${sizeMB} MB</span>
                    <div style="flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;">
                        <div id="${id}_bar" style="width:0%;height:100%;background:var(--green);transition:width .15s;"></div>
                    </div>
                    <span id="${id}_pct" style="min-width:32px;text-align:right;color:var(--muted);">0%</span>
                </div>`);

            this.uploadsInProgress++;
            this.uploadFileWithProgress(file, job.db_id, id);
        });

        // Reset input so same file can be re-selected
        event.target.value = '';
    },

    uploadFileWithProgress(file, jobDbId, elementId) {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', mgtData.restUrl + `jobs/${jobDbId}/media`);
        xhr.setRequestHeader('X-WP-Nonce', mgtData.nonce);

        xhr.upload.addEventListener('progress', (e) => {
            if (!e.lengthComputable) return;
            const pct = Math.round((e.loaded / e.total) * 100);
            const bar = document.getElementById(`${elementId}_bar`);
            const label = document.getElementById(`${elementId}_pct`);
            if (bar) bar.style.width = pct + '%';
            if (label) label.textContent = pct + '%';
        });

        xhr.addEventListener('load', () => {
            this.uploadsInProgress--;
            const row = document.getElementById(elementId);
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.attachments && data.attachments.length > 0) {
                        this.uploadedAttachments.push({
                            id: data.attachments[0].id,
                            url: data.attachments[0].url,
                            name: file.name,
                            type: file.type
                        });
                    }
                } catch(e) {}
                // Mark complete
                const bar = document.getElementById(`${elementId}_bar`);
                const label = document.getElementById(`${elementId}_pct`);
                if (bar) bar.style.background = 'var(--green)';
                if (label) { label.textContent = '✔'; label.style.color = 'var(--green)'; }
            } else {
                if (row) row.style.color = 'var(--red)';
                const label = document.getElementById(`${elementId}_pct`);
                if (label) { label.textContent = '✖'; label.style.color = 'var(--red)'; }
            }
            this.checkUploadsComplete();
        });

        xhr.addEventListener('error', () => {
            this.uploadsInProgress--;
            const label = document.getElementById(`${elementId}_pct`);
            if (label) { label.textContent = '✖'; label.style.color = 'var(--red)'; }
            this.checkUploadsComplete();
        });

        xhr.send(formData);
    },

    checkUploadsComplete() {
        if (this.uploadsInProgress <= 0) {
            const btn = document.getElementById('btnPostUpdate');
            if (btn) { btn.disabled = false; btn.textContent = 'Post Update'; }
        }
    },

    async postUpdate() {
        const text = document.getElementById('updateText').value.trim();
        const visible = document.getElementById('updateVisible').checked;
        const job = this.getActiveJob();
        if (!job) return;
        if (!text && this.uploadedAttachments.length === 0) {
            this.showToast('error', 'Empty', 'Write a note or attach files.');
            return;
        }
        if (this.uploadsInProgress > 0) {
            this.showToast('error', 'Wait', 'Files are still uploading.');
            return;
        }

        const btn = document.getElementById('btnPostUpdate');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

        // Create update object with already-uploaded attachments
        const update = {
            text: text || '',
            tech: mgtData.userName,
            ts: Date.now(),
            customerVisible: visible,
            attachments: [...this.uploadedAttachments]
        };

        if (!job.notes) job.notes = [];
        job.notes.push(update);

        // Save to server
        try {
            await this.api(`jobs/${job.db_id}`, 'PUT', { notes: job.notes });
        } catch (e) {
            console.error('postUpdate save error:', e);
        }

        // Send email if visible to customer
        if (visible) {
            try {
                await this.api(`jobs/${job.db_id}/notify`, 'POST', {
                    text: text || '(files attached)',
                    attachments: this.uploadedAttachments.map(a => ({ id: a.id, name: a.name, url: a.url }))
                });
                this.showToast('success', 'Sent', 'Update posted & email sent to linked customers.');
            } catch (e) {
                this.showToast('success', 'Posted', 'Update saved. Email delivery may have failed.');
            }
        } else {
            this.showToast('success', 'Posted', 'Internal update saved.');
        }

        // Reset
        this.uploadedAttachments = [];
        this.pendingFiles = [];
        this.renderDetail();
    },

    async deleteJob(db_id) {
        if (!confirm('Delete this work order? This cannot be undone.')) return;
        await this.api(`jobs/${db_id}`, 'DELETE');
        this.jobs = this.jobs.filter(j => j.db_id !== db_id);
        delete this.jobDetails[db_id];
        this.activeJobId = this.jobs.length > 0 ? this.jobs[0].db_id : null;
        this.renderSidebar();
        this.updateStats();
        if (this.activeJobId) {
            await this.loadJobDetail(this.activeJobId);
        }
        this.renderDetail();
    },

    async toggleArchive(db_id) {
        const job = this.jobDetails[db_id] || this.jobs.find(j => j.db_id === db_id);
        if (!job) return;
        const newArchivedState = !job.archived;
        job.archived = newArchivedState;
        this.syncToList(db_id);
        await this.api(`jobs/${db_id}`, 'PUT', { archived: newArchivedState });
        this.renderSidebar();
        this.renderDetail();
    },

    async editNote(realIndex) {
        const job = this.getActiveJob();
        if (!job || !job.notes[realIndex]) return;
        
        document.getElementById('editNoteIndex').value = realIndex;
        document.getElementById('editNoteText').value = job.notes[realIndex].text || '';
        
        this.renderEditNoteAttachments(job.notes[realIndex].attachments || []);
        this.openModal('editNoteModal');
    },

    renderEditNoteAttachments(atts) {
        const container = document.getElementById('editNoteAttachments');
        if (!atts || atts.length === 0) {
            container.innerHTML = '<div style="color:var(--muted);font-size:.75rem;">No attachments.</div>';
            return;
        }
        container.innerHTML = atts.map((a, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface2);padding:.3rem .5rem;border:1px solid var(--border);font-size:.75rem;border-radius:3px;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.esc(a.name)}</span>
                <button class="btn btn-danger" style="padding:.1rem .3rem;font-size:.6rem;height:auto;" onclick="MGT.removeEditNoteAttachment(${i})">Delete</button>
            </div>
        `).join('');
    },

    removeEditNoteAttachment(attIndex) {
        const realIndex = parseInt(document.getElementById('editNoteIndex').value);
        const job = this.getActiveJob();
        if (!job || !job.notes[realIndex]) return;
        
        if (!confirm('Remove this attachment from the update?')) return;
        job.notes[realIndex].attachments.splice(attIndex, 1);
        this.renderEditNoteAttachments(job.notes[realIndex].attachments);
    },

    async saveEditNote() {
        const realIndex = parseInt(document.getElementById('editNoteIndex').value);
        const job = this.getActiveJob();
        if (!job || !job.notes[realIndex]) return;
        
        const newText = document.getElementById('editNoteText').value.trim();
        job.notes[realIndex].text = newText;
        
        await this.api(`jobs/${job.db_id}`, 'PUT', { notes: job.notes });
        this.closeModal('editNoteModal');
        this.renderDetail();
        this.showToast('success', 'Updated', 'Update note modified.');
    },

    async deleteNote(realIndex) {
        if (!confirm('Are you sure you want to delete this update?')) return;
        
        const job = this.getActiveJob();
        if (!job || !job.notes[realIndex]) return;
        
        job.notes.splice(realIndex, 1);
        await this.api(`jobs/${job.db_id}`, 'PUT', { notes: job.notes });
        this.renderDetail();
        this.showToast('success', 'Deleted', 'Update note removed.');
    },

    // ── CUSTOMER MANAGEMENT ──
    renderCustomerTable() {
        const tbodyCust = document.getElementById('customerTableBody');
        const tbodyAdmin = document.getElementById('adminTableBody');
        
        const customers = this.customers.filter(c => c.role === 'customer');
        const admins = this.customers.filter(c => c.role === 'admin');

        tbodyCust.innerHTML = customers.length === 0 
            ? '<tr><td colspan="5" style="color:var(--muted);padding:1.5rem .75rem">No customers.</td></tr>' 
            : customers.map(c => {
                const tags = (c.linkedJobs || []).map(j => `<span class="linked-job-tag">${this.esc(j)}</span>`).join('');
                return `<tr>
                    <td>${this.esc(c.name)}</td>
                    <td style="color:var(--muted)">${this.esc(c.email)}</td>
                    <td>${this.esc(c.company || '—')}</td>
                    <td>${tags || '<span style="color:var(--muted2)">None</span>'}</td>
                    <td>
                        <div style="display:flex;gap:5px;flex-wrap:wrap;">
                            <button class="btn" style="padding:4px 8px;font-size:10px;" onclick="MGT.linkJobsToUser(${c.id})">Link Jobs</button>
                            <button class="btn" style="padding:4px 8px;font-size:10px;" onclick="MGT.unlinkAllJobs(${c.id})">Unlink All</button>
                            <button class="btn" style="padding:4px 8px;font-size:10px;" onclick="MGT.resetPassword(${c.id})">Reset Pwd</button>
                            <button class="btn btn-danger" style="padding:4px 8px;font-size:10px;" onclick="MGT.deleteUser(${c.id})">Delete</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');

        tbodyAdmin.innerHTML = admins.length === 0 
            ? '<tr><td colspan="4" style="color:var(--muted);padding:1.5rem .75rem">No admins.</td></tr>' 
            : admins.map(c => `<tr>
                <td>${this.esc(c.name)}</td>
                <td style="color:var(--muted)">${this.esc(c.email)}</td>
                <td>${this.esc(c.company || '—')}</td>
                <td>${this.esc(c.roleLabel || 'Admin')}</td>
            </tr>`).join('');
    },

    async sendInvite() {
        const payload = {
            name: document.getElementById('inv-name').value.trim(),
            email: document.getElementById('inv-email').value.trim(),
            job_ref: document.getElementById('inv-job').value.trim(),
            message: document.getElementById('inv-message').value.trim()
        };
        if(!payload.email || !payload.name) { this.showToast('error', 'Error', 'Name and Email required'); return; }
        
        await this.api('customers/invite', 'POST', payload);
        this.closeModal('inviteModal');
        this.showToast('success', 'Invite Sent', 'Email sent to ' + payload.email);
    },

    openLinkCustomersModal() {
        const job = this.getActiveJob();
        if(!job) return;
        this.linkingJobDbId = job.db_id;
        document.getElementById('linkJobTitle').textContent = `${job.id} — ${job.desc}`;
        
        const container = document.getElementById('linkCustomerCheckboxes');
        // Only show customers (not admins)
        const customers = this.customers.filter(c => c.role === 'customer');
        container.innerHTML = customers.map(c => {
            const isLinked = (job.linkedCustomers || []).includes(c.id);
            return `<label style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;cursor:pointer;font-size:.82rem;border-bottom:1px solid var(--border)">
                <input type="checkbox" value="${c.id}" ${isLinked ? 'checked' : ''} style="accent-color:var(--green);width:16px;height:16px;"/>
                <span><strong style="color:var(--text)">${this.esc(c.name || c.email)}</strong> <span style="color:var(--muted)">— ${this.esc(c.email)}</span></span>
            </label>`;
        }).join('');
        document.getElementById('linkCustomerSearch').value = '';
        this.openModal('linkCustomersModal');
    },

    filterLinkCustomers() {
        const query = document.getElementById('linkCustomerSearch').value.toLowerCase();
        const labels = document.querySelectorAll('#linkCustomerCheckboxes label');
        labels.forEach(lbl => {
            const text = lbl.textContent.toLowerCase();
            lbl.style.display = text.includes(query) ? 'flex' : 'none';
        });
    },

    async saveLinkCustomers() {
        const boxes = document.querySelectorAll('#linkCustomerCheckboxes input[type=checkbox]');
        const job = this.jobDetails[this.linkingJobDbId] || this.jobs.find(j => j.db_id === this.linkingJobDbId);
        if (!job) return;

        const linkedCustomers = [];
        boxes.forEach(box => {
            if (box.checked) linkedCustomers.push(parseInt(box.value));
        });
        
        job.linkedCustomers = linkedCustomers;
        await this.api(`jobs/${job.db_id}`, 'PUT', { linkedCustomers });
        this.closeModal('linkCustomersModal');
        this.showToast('success', 'Saved', 'Customer links updated.');
        // Invalidate detail cache and reload
        delete this.jobDetails[job.db_id];
        await this.loadData();
        await this.loadJobDetail(job.db_id);
        this.renderDetail();
        this.renderSidebar();
    },

    async resetPassword(id) {
        if (!confirm('Send a password reset email to this user?')) return;
        await this.api(`customers/${id}/reset-password`, 'POST');
        this.showToast('success', 'Sent', 'Password reset email sent.');
    },

    async deleteUser(id) {
        if (!confirm('Are you sure you want to permanently delete this user account?')) return;
        await this.api(`customers/${id}`, 'DELETE');
        this.showToast('success', 'Deleted', 'User account deleted.');
        await this.loadData();
        this.renderCustomerTable();
    },

    async unlinkAllJobs(id) {
        if (!confirm('Remove all linked jobs from this user?')) return;
        await this.api(`customers/${id}/link`, 'PUT', { linkedJobs: [] });
        this.showToast('success', 'Unlinked', 'All jobs removed from user.');
        await this.loadData();
        this.renderCustomerTable();
    },

    linkJobsToUser(id) {
        const cust = this.customers.find(c => c.id === id);
        if(!cust) return;
        this.linkingUserId = id;

        document.getElementById('linkUserJobsTitle').textContent = cust.name || cust.email;
        const container = document.getElementById('linkUserJobsCheckboxes');
        
        container.innerHTML = this.jobs.map(j => {
            const isLinked = (cust.linkedJobs || []).includes(j.id);
            return `<label style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;cursor:pointer;font-size:.82rem;border-bottom:1px solid var(--border)">
                <input type="checkbox" value="${j.id}" ${isLinked ? 'checked' : ''} style="accent-color:var(--green);width:16px;height:16px;"/>
                <span><strong style="color:var(--text)">${this.esc(j.id)}</strong> <span style="color:var(--muted)">— ${this.esc(j.desc)}</span></span>
            </label>`;
        }).join('');
        this.openModal('linkUserJobsModal');
    },

    async saveLinkUserJobs() {
        const boxes = document.querySelectorAll('#linkUserJobsCheckboxes input[type=checkbox]');
        const linkedJobs = [];
        boxes.forEach(b => { if(b.checked) linkedJobs.push(b.value); });
        
        await this.api(`customers/${this.linkingUserId}/link`, 'PUT', { linkedJobs });
        this.closeModal('linkUserJobsModal');
        this.showToast('success', 'Saved', 'User job links updated.');
        await this.loadData();
        this.renderCustomerTable();
    },

    async loadEmailSettings() {
        const settings = await this.api('settings', 'GET');
        let html = '';
        this.STAGES.forEach((s, i) => {
            const checked = settings[`stage_${i}`] ? 'checked' : '';
            html += `<label style="display:flex;align-items:center;gap:.6rem;font-size:.85rem;cursor:pointer;">
                <input type="checkbox" id="setting_stage_${i}" ${checked} style="accent-color:var(--green);width:16px;height:16px;"/>
                Notify when stage moves to <strong>${s.label}</strong>
            </label>`;
        });
        document.getElementById('emailSettingsCheckboxes').innerHTML = html;
    },

    async saveEmailSettings() {
        const payload = {};
        this.STAGES.forEach((s, i) => {
            payload[`stage_${i}`] = document.getElementById(`setting_stage_${i}`).checked;
        });
        await this.api('settings', 'POST', payload);
        this.showToast('success', 'Saved', 'Email settings updated.');
    },

    // ── CUSTOMER PORTAL VIEW ──
    async renderCustomerView() {
        const container = document.getElementById('customerMainContent');
        if (this.jobs.length === 0) {
            container.innerHTML = `<div class="customer-hero"><div class="customer-hero-label">No Jobs Yet</div><div class="customer-hero-title">No work orders linked</div></div>`;
            return;
        }

        // Show loading while fetching details
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);"><div style="font-size:2rem;margin-bottom:.5rem">⚙</div>Loading your work orders...</div>';

        // Load full details for all customer jobs (typically 1-5 jobs)
        await Promise.all(this.jobs.map(j => this.loadJobDetail(j.db_id)));

        container.innerHTML = `<div class="customer-hero" style="margin-bottom:1.25rem">
            <div class="customer-hero-label">Welcome back</div>
            <div class="customer-hero-title">${this.esc(mgtData.userName)}</div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:.3rem">${this.jobs.length} work order(s) linked</div>
        </div>` + this.jobs.map(job => {
            const detail = this.jobDetails[job.db_id] || job;
            const pct = detail.progress || 0;
            const stageName = this.STAGES[Math.min(detail.stageIndex, this.STAGES.length-1)].label;
            
            const stagesHTML = this.STAGES.map((s,i) => `
                <div class="cjc-stage ${i < detail.stageIndex ? 'done' : ''} ${i === detail.stageIndex ? 'current' : ''}">
                <div class="cjc-stage-num">${i < detail.stageIndex ? '✔' : String(i+1)}</div>
                <div class="cjc-stage-name">${s.label}</div>
                </div>`).join('');

            const visibleUpdates = (detail.notes || []).filter(n => n.customerVisible);
            const updatesHTML = visibleUpdates.length === 0
                ? '<div style="color:var(--muted2);font-size:.78rem;padding:.4rem 0">No shop updates yet.</div>'
                : [...visibleUpdates].reverse().map((n, ni) => {
                    const galleryId = `cgallery_${job.db_id}_${ni}`;
                    const attHTML = this.renderGallery(n.attachments || [], galleryId);
                    return `
                <div style="padding:.6rem 0; border-bottom:1px solid var(--border);">
                    <div style="font-size:.65rem; color:var(--muted); margin-bottom:.3rem; font-family:'Barlow Condensed',sans-serif;">${this.fmtDate(n.ts)}</div>
                    <div style="font-size:.8rem;line-height:1.5;">${this.esc(n.text)}</div>
                    ${attHTML}
                </div>`;
                }).join('');

            return `<div class="customer-job-card">
                <div class="cjc-header">
                    <div>
                        <div class="cjc-id">${this.esc(detail.id)}</div>
                        <div style="font-size:.78rem;color:var(--muted);margin-top:.2rem">${this.esc(detail.desc)}</div>
                    </div>
                    <div class="status-badge ${this.badgeClass(detail)}">${stageName}</div>
                </div>
                <div class="cjc-body">
                    <div><div class="section-heading">Repair Progress</div><div class="cjc-stage-row">${stagesHTML}</div></div>
                    <div style="margin-top:1rem;">
                        <div class="section-heading">Tasks Completed</div>
                        <div class="progress-bar-full"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
                    </div>
                    <div class="cjc-info-row" style="margin-top:1rem;">
                        <div class="cjc-info-cell"><div class="info-label">Date In</div><div class="info-value" style="font-size:.9rem">${detail.dateIn || '—'}</div></div>
                        <div class="cjc-info-cell"><div class="info-label">Est. Complete</div><div class="info-value" style="font-size:.9rem;color:var(--green)">${detail.eta || '—'}</div></div>
                    </div>
                    <div style="margin-top:1rem;">
                        <div class="section-heading">Shop Updates</div>
                        ${updatesHTML}
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    // ── GALLERY & LIGHTBOX ──
    lightboxItems: [],
    lightboxIndex: 0,

    renderGallery(attachments, galleryId) {
        if (!attachments || attachments.length === 0) return '';
        const tiles = attachments.map((a, i) => {
            const isImage = a.type && a.type.startsWith('image');
            if (isImage) {
                return `<div class="gallery-tile" onclick="MGT.openLightbox('${galleryId}', ${i})">
                    <img src="${a.url}" alt="${this.esc(a.name)}" />
                </div>`;
            }
            // PDF / other file tile
            const shortName = a.name && a.name.length > 18 ? a.name.substring(0, 15) + '...' : (a.name || 'File');
            return `<div class="gallery-tile gallery-tile-pdf" onclick="MGT.openLightbox('${galleryId}', ${i})">
                <div style="font-size:1.6rem;margin-bottom:.3rem;">📄</div>
                <div style="font-size:.6rem;line-height:1.3;text-align:center;color:var(--text);word-break:break-all;">${this.esc(shortName)}</div>
            </div>`;
        }).join('');
        // Store the items so lightbox can access them
        this._galleries = this._galleries || {};
        this._galleries[galleryId] = attachments;
        return `<div class="gallery-grid" style="margin-top:.5rem;">${tiles}</div>`;
    },

    openLightbox(galleryId, index) {
        this._galleries = this._galleries || {};
        this.lightboxItems = this._galleries[galleryId] || [];
        this.lightboxIndex = index;
        this.renderLightboxItem();
        document.getElementById('mgtLightbox').classList.add('active');
        document.addEventListener('keydown', this._lbKeyHandler);
    },

    closeLightbox() {
        document.getElementById('mgtLightbox').classList.remove('active');
        document.removeEventListener('keydown', this._lbKeyHandler);
    },

    _lbKeyHandler(e) {
        if (e.key === 'Escape') MGT.closeLightbox();
        if (e.key === 'ArrowLeft') MGT.lightboxNav(-1);
        if (e.key === 'ArrowRight') MGT.lightboxNav(1);
    },

    lightboxNav(dir) {
        this.lightboxIndex = (this.lightboxIndex + dir + this.lightboxItems.length) % this.lightboxItems.length;
        this.renderLightboxItem();
    },

    renderLightboxItem() {
        const item = this.lightboxItems[this.lightboxIndex];
        if (!item) return;
        const content = document.getElementById('lbContent');
        const caption = document.getElementById('lbCaption');
        const isImage = item.type && item.type.startsWith('image');

        if (isImage) {
            content.innerHTML = `<img src="${item.url}" class="lb-image" />`;
        } else {
            content.innerHTML = `<div class="lb-pdf">
                <div style="font-size:4rem;margin-bottom:1rem;">📄</div>
                <div style="font-size:1rem;margin-bottom:1.5rem;color:var(--text);word-break:break-all;max-width:400px;text-align:center;">${this.esc(item.name || 'File')}</div>
                <a href="${item.url}" target="_blank" class="btn btn-primary" style="padding:.6rem 2rem;font-size:.85rem;">Open File ↗</a>
            </div>`;
        }
        caption.textContent = `${this.lightboxIndex + 1} / ${this.lightboxItems.length} — ${item.name || ''}`;

        // Show/hide nav arrows
        document.querySelector('.lb-prev').style.display = this.lightboxItems.length > 1 ? 'flex' : 'none';
        document.querySelector('.lb-next').style.display = this.lightboxItems.length > 1 ? 'flex' : 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    MGT.init();
});
