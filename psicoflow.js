// Configuração da API
const API_BASE_URL = 'http://localhost:3000/api';
let currentUser = null;
let authToken = null;

// Funções de API
class ApiService {
    static async login(username, password) {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) throw new Error('Credenciais inválidas');
        
        const data = await response.json();
        authToken = data.token;
        currentUser = data.user;
        
        // Salvar token no localStorage
        localStorage.setItem('psicoflow_token', authToken);
        localStorage.setItem('psicoflow_user', JSON.stringify(currentUser));
        
        return data;
    }

    static async logout() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('psicoflow_token');
        localStorage.removeItem('psicoflow_user');
    }

    static async get(endpoint) {
        const response = await fetch(`${API_BASE_URL}/data${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            window.location.href = '/login.html';
            throw new Error('Sessão expirada');
        }
        
        if (!response.ok) throw new Error('Erro na requisição');
        
        return response.json();
    }

    static async post(endpoint, data) {
        const response = await fetch(`${API_BASE_URL}/data${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.status === 401) {
            window.location.href = '/login.html';
            throw new Error('Sessão expirada');
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro na requisição');
        }
        
        return response.json();
    }

    static async put(endpoint, data) {
        const response = await fetch(`${API_BASE_URL}/data${endpoint}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.status === 401) {
            window.location.href = '/login.html';
            throw new Error('Sessão expirada');
        }
        
        if (!response.ok) throw new Error('Erro na requisição');
        
        return response.json();
    }

    static async delete(endpoint) {
        const response = await fetch(`${API_BASE_URL}/data${endpoint}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.status === 401) {
            window.location.href = '/login.html';
            throw new Error('Sessão expirada');
        }
        
        if (!response.ok) throw new Error('Erro na requisição');
        
        return response.json();
    }

    static async uploadFile(file, folderId = null, description = '') {
        // Converter arquivo para base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const response = await fetch(`${API_BASE_URL}/data/upload`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            file_data: e.target.result,
                            file_name: file.name,
                            file_type: file.type,
                            folder_id: folderId,
                            description: description
                        })
                    });
                    
                    if (!response.ok) throw new Error('Erro no upload');
                    
                    resolve(await response.json());
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsDataURL(file);
        });
    }
}

// Sistema principal
class PsicoFlowSystem {
    constructor() {
        this.currentPatientId = null;
        this.currentAppointmentId = null;
        this.currentDate = new Date();
        this.editingPatientId = null;
        this.editingNoteId = null;
        this.currentFolderId = null;
        this.currentFolderType = null;
    }

    async init() {
        // Verificar autenticação
        const savedToken = localStorage.getItem('psicoflow_token');
        const savedUser = localStorage.getItem('psicoflow_user');
        
        if (savedToken && savedUser) {
            try {
                authToken = savedToken;
                currentUser = JSON.parse(savedUser);
                
                // Verificar se o token ainda é válido
                await ApiService.get('/dashboard');
                
                // Se estiver na tela de login, redirecionar para o sistema
                if (window.location.pathname.includes('login.html') || 
                    window.location.pathname === '/') {
                    window.location.href = '/system.html';
                }
            } catch (error) {
                // Token inválido, limpar localStorage
                localStorage.removeItem('psicoflow_token');
                localStorage.removeItem('psicoflow_user');
                if (!window.location.pathname.includes('benefits.html')) {
                    window.location.href = '/benefits.html';
                }
            }
        } else {
            if (!window.location.pathname.includes('benefits.html') && 
                !window.location.pathname.includes('login.html')) {
                window.location.href = '/benefits.html';
            }
        }

        this.setupEventListeners();
        
        if (window.location.pathname.includes('system.html')) {
            await this.loadInitialData();
        }
    }

    async loadInitialData() {
        // Configurar data atual
        const today = new Date().toISOString().split('T')[0];
        
        // Configurar data mínima para hoje nos formulários
        document.querySelectorAll('input[type="date"]').forEach(input => {
            if (input.id !== 'patientBirthDateInput' && input.id !== 'noteDate') {
                input.value = today;
                input.min = today;
            }
        });

        // Configurar hora atual
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (document.getElementById('appointmentTime')) {
            document.getElementById('appointmentTime').value = currentTime;
        }

        // Carregar dados do dashboard
        await this.loadDashboard();

        // Atualizar informações do usuário
        if (currentUser) {
            document.getElementById('userNameDisplay').textContent = currentUser.full_name || currentUser.username;
            document.getElementById('currentUserName').textContent = currentUser.full_name || currentUser.username;
        }
    }

    async loadDashboard() {
        try {
            const stats = await ApiService.get('/dashboard');
            
            document.getElementById('activePatients').textContent = stats.activePatients || 0;
            document.getElementById('todayAppointments').textContent = stats.todayAppointments || 0;
            document.getElementById('pendingReports').textContent = stats.pendingReports || 0;
            document.getElementById('monthlyRevenue').textContent = `R$ ${(stats.monthlyRevenue || 0).toFixed(2)}`;
            
            // Carregar atividades recentes
            await this.loadActivities();
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
        }
    }

    async loadActivities() {
        try {
            const activities = await ApiService.get('/activities');
            const activityList = document.getElementById('activityList');
            const emptyActivity = document.getElementById('emptyActivity');
            
            if (!activities || activities.length === 0) {
                activityList.innerHTML = '';
                if (emptyActivity) emptyActivity.classList.remove('hidden');
                return;
            }
            
            if (emptyActivity) emptyActivity.classList.add('hidden');
            activityList.innerHTML = '';
            
            activities.slice(0, 5).forEach(activity => {
                const activityDate = new Date(activity.created_at);
                const timeAgo = this.getTimeAgo(activityDate);
                
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                
                let icon = 'fa-calendar-check';
                let color = 'blue';
                let typeText = 'Consulta';
                
                if (activity.activity_type === 'patient') {
                    icon = 'fa-user-injured';
                    color = 'green';
                    typeText = 'Paciente';
                } else if (activity.activity_type === 'report') {
                    icon = 'fa-file-alt';
                    color = 'orange';
                    typeText = 'Relatório';
                } else if (activity.activity_type === 'payment') {
                    icon = 'fa-dollar-sign';
                    color = 'purple';
                    typeText = 'Pagamento';
                }
                
                activityItem.innerHTML = `
                    <div class="activity-icon ${color}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <h4>${typeText}: ${activity.activity_description}</h4>
                        ${activity.patient_first_name ? `<p>Paciente: ${activity.patient_first_name} ${activity.patient_last_name}</p>` : ''}
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                `;
                
                activityList.appendChild(activityItem);
            });
        } catch (error) {
            console.error('Erro ao carregar atividades:', error);
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) {
            return `há ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
        } else if (diffHours < 24) {
            return `há ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
        } else if (diffDays < 7) {
            return `há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
        } else {
            return date.toLocaleDateString('pt-BR');
        }
    }

    setupEventListeners() {
        // Login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('username').value.trim();
                const password = document.getElementById('password').value;
                
                if (!username || !password) {
                    this.showNotification('Por favor, preencha todos os campos.', 'error');
                    return;
                }
                
                try {
                    const loginBtn = document.getElementById('loginButton');
                    const loginBtnText = document.getElementById('loginBtnText');
                    const originalText = loginBtnText.textContent;
                    
                    loginBtnText.innerHTML = '<div class="loading"></div> Processando...';
                    loginBtn.disabled = true;
                    
                    const data = await ApiService.login(username, password);
                    
                    // Esconder credenciais por segurança
                    document.getElementById('username').value = '';
                    document.getElementById('password').value = '';
                    
                    // Redirecionar para o sistema
                    window.location.href = '/system.html';
                    
                } catch (error) {
                    this.showNotification('Credenciais inválidas.', 'error');
                    loginForm.classList.add('shake');
                    setTimeout(() => loginForm.classList.remove('shake'), 500);
                    document.getElementById('username').focus();
                    
                    const loginBtn = document.getElementById('loginButton');
                    const loginBtnText = document.getElementById('loginBtnText');
                    loginBtnText.textContent = 'Acessar Sistema';
                    loginBtn.disabled = false;
                }
            });
        }
        
        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.showConfirmModal(
                'Tem certeza que deseja sair do sistema?',
                async () => {
                    await ApiService.logout();
                    window.location.href = '/benefits.html';
                }
            );
        });
        
        // Navegação - REMOVER CHATBOT
        document.querySelectorAll('.nav-item').forEach(item => {
            // Não incluir chatbot na navegação
            if (item.getAttribute('data-page') === 'chatbot') return;
            
            item.addEventListener('click', async () => {
                const pageId = item.getAttribute('data-page') + 'Page';
                
                // Atualizar navegação ativa
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Mostrar página correspondente
                document.querySelectorAll('.content-page').forEach(page => page.classList.remove('active'));
                document.getElementById(pageId).classList.add('active');
                
                // Carregar dados da página
                switch(item.getAttribute('data-page')) {
                    case 'dashboard':
                        await this.loadDashboard();
                        break;
                    case 'patients':
                        await this.loadPatientsList();
                        break;
                    case 'agenda':
                        await this.loadAgenda();
                        break;
                    case 'finance':
                        await this.updateFinanceSummary();
                        break;
                    case 'reports':
                        await this.loadReportsList();
                        break;
                    case 'files':
                        await this.loadFolders('files');
                        break;
                    case 'documents':
                        await this.loadFolders('documents');
                        break;
                    // REMOVER chatbot
                }
            });
        });
        
        // Novo paciente
        document.getElementById('newPatientBtn')?.addEventListener('click', () => this.openPatientModal());
        document.getElementById('emptyNewPatientBtn')?.addEventListener('click', () => this.openPatientModal());
        
        // Nova consulta
        document.getElementById('newAppointmentBtn')?.addEventListener('click', () => this.openAppointmentModal());
        document.getElementById('quickAppointment')?.addEventListener('click', () => this.openAppointmentModal());
        
        // Navegação da agenda
        document.getElementById('prevDay')?.addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() - 1);
            this.updateAgendaDate();
            this.loadAgenda();
        });
        
        document.getElementById('nextDay')?.addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() + 1);
            this.updateAgendaDate();
            this.loadAgenda();
        });
        
        document.getElementById('todayBtn')?.addEventListener('click', () => {
            this.currentDate = new Date();
            this.updateAgendaDate();
            this.loadAgenda();
        });
        
        // Configurar formulários e modais
        this.setupForms();
        this.setupModals();
    }

    setupForms() {
        // Formulário de pagamento
        const paymentForm = document.getElementById('paymentForm');
        if (paymentForm) {
            paymentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const patientId = parseInt(document.getElementById('paymentPatient').value);
                const date = document.getElementById('paymentDate').value;
                const amount = parseFloat(document.getElementById('paymentAmount').value);
                const type = document.getElementById('paymentType').value;
                const description = document.getElementById('paymentDescription').value;
                
                if (!patientId) {
                    this.showNotification('Selecione um paciente.', 'error');
                    return;
                }
                
                if (amount <= 0 || isNaN(amount)) {
                    this.showNotification('Informe um valor válido.', 'error');
                    return;
                }
                
                try {
                    await ApiService.post('/payments', {
                        patient_id: patientId,
                        payment_date: date,
                        amount: amount,
                        payment_type: type,
                        description: description
                    });
                    
                    paymentForm.reset();
                    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
                    
                    await this.updateFinanceSummary();
                    this.showNotification('Pagamento registrado com sucesso!', 'success');
                    
                } catch (error) {
                    this.showNotification('Erro ao registrar pagamento.', 'error');
                }
            });
        }
    }

    async loadPatientsList() {
        try {
            const patients = await ApiService.get('/patients');
            const patientsList = document.getElementById('patientsList');
            const emptyPatientsList = document.getElementById('emptyPatientsList');
            
            if (!patients || patients.length === 0) {
                patientsList.innerHTML = '';
                emptyPatientsList.classList.remove('hidden');
                return;
            }
            
            emptyPatientsList.classList.add('hidden');
            patientsList.innerHTML = '';
            
            patients.forEach(patient => {
                const patientItem = document.createElement('div');
                patientItem.className = 'patient-item';
                patientItem.setAttribute('data-id', patient.id);
                
                const initials = patient.first_name.charAt(0) + patient.last_name.charAt(0);
                const fullName = `${patient.first_name} ${patient.last_name}`;
                const age = this.calculateAge(patient.birth_date);
                const genderText = patient.gender === 'male' ? 'Masculino' : 
                                  patient.gender === 'female' ? 'Feminino' : 'Outro';
                
                patientItem.innerHTML = `
                    <div class="patient-avatar">${initials}</div>
                    <div class="patient-info">
                        <h4>${fullName}</h4>
                        <p><i class="fas fa-user"></i> ${age} anos • ${genderText}</p>
                        <p><i class="fas fa-calendar"></i> Desde ${this.formatDate(patient.first_session_date)}</p>
                        <span class="patient-status ${patient.status === 'active' ? 'status-active' : 'status-inactive'}">
                            ${patient.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>
                    <div class="patient-actions">
                        <button class="action-btn edit-patient-btn" data-id="${patient.id}" title="Editar paciente">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete delete-patient-btn" data-id="${patient.id}" title="Excluir paciente">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                // Eventos
                patientItem.addEventListener('click', (e) => {
                    if (!e.target.closest('.patient-actions')) {
                        this.selectPatient(patient.id);
                    }
                });
                
                patientItem.querySelector('.edit-patient-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editPatient(patient.id);
                });
                
                patientItem.querySelector('.delete-patient-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deletePatient(patient.id);
                });
                
                patientsList.appendChild(patientItem);
            });
            
            // Busca
            const patientSearch = document.getElementById('patientSearch');
            if (patientSearch) {
                patientSearch.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    document.querySelectorAll('.patient-item').forEach(item => {
                        const patientName = item.querySelector('h4').textContent.toLowerCase();
                        item.style.display = patientName.includes(searchTerm) || searchTerm === '' ? 'flex' : 'none';
                    });
                });
            }
            
        } catch (error) {
            console.error('Erro ao carregar pacientes:', error);
            this.showNotification('Erro ao carregar pacientes.', 'error');
        }
    }

    async selectPatient(patientId) {
        try {
            const patients = await ApiService.get('/patients');
            const patient = patients.find(p => p.id === patientId);
            if (!patient) return;
            
            this.currentPatientId = patientId;
            
            // Atualizar seleção
            document.querySelectorAll('.patient-item').forEach(item => {
                item.classList.remove('active');
                if (parseInt(item.getAttribute('data-id')) === patientId) {
                    item.classList.add('active');
                }
            });
            
            // Mostrar detalhes
            document.getElementById('emptyPatientDetail').classList.add('hidden');
            document.getElementById('patientDetail').classList.remove('hidden');
            
            // Preencher informações
            const initials = patient.first_name.charAt(0) + patient.last_name.charAt(0);
            const fullName = `${patient.first_name} ${patient.last_name}`;
            const age = this.calculateAge(patient.birth_date);
            const genderText = patient.gender === 'male' ? 'Masculino' : 
                              patient.gender === 'female' ? 'Feminino' : 'Outro';
            
            document.getElementById('patientDetailAvatar').textContent = initials;
            document.getElementById('patientDetailName').textContent = fullName;
            document.getElementById('patientDetailInfo').textContent = `${age} anos • ${genderText}`;
            
            // Preencher dados pessoais
            document.getElementById('patientBirthDate').textContent = this.formatDate(patient.birth_date);
            document.getElementById('patientCPF').textContent = this.formatCPF(patient.cpf) || 'Não informado';
            document.getElementById('patientPhone').textContent = patient.phone || 'Não informado';
            document.getElementById('patientEmail').textContent = patient.email || 'Não informado';
            document.getElementById('patientAddress').textContent = patient.address || 'Não informado';
            document.getElementById('patientOccupation').textContent = patient.profession || 'Não informado';
            document.getElementById('firstSessionDate').textContent = this.formatDate(patient.first_session_date);
            document.getElementById('sessionFrequency').textContent = patient.session_frequency === 'weekly' ? 'Semanal' : 'Quinzenal';
            document.getElementById('therapyReason').textContent = patient.therapy_reason || 'Não informado';
            
            // Configurar botões
            document.getElementById('deletePatientBtn').onclick = () => this.deletePatient(patientId);
            document.getElementById('editPatientBtn').onclick = () => this.editPatient(patientId);
            
            // Carregar conteúdo das abas
            await this.loadPatientSessions(patientId);
            await this.loadClinicalNotes(patientId);
            await this.loadPatientFinance(patientId);
            
            this.setupPatientTabs();
            
        } catch (error) {
            console.error('Erro ao selecionar paciente:', error);
            this.showNotification('Erro ao carregar paciente.', 'error');
        }
    }

    async loadPatientSessions(patientId) {
        try {
            const appointments = await ApiService.get(`/appointments?patient_id=${patientId}`);
            const container = document.getElementById('sessionsTab');
            
            if (!appointments || appointments.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 40px 20px;">
                        <i class="fas fa-calendar-alt"></i>
                        <h4>Nenhuma sessão registrada</h4>
                        <p>Este paciente ainda não tem sessões agendadas</p>
                    </div>
                `;
                return;
            }
            
            let html = '<div class="activity-list">';
            appointments.forEach(appointment => {
                const statusText = {
                    'scheduled': 'Agendada',
                    'completed': 'Realizada',
                    'not_completed': 'Não Realizada',
                    'rescheduled': 'Reagendada'
                }[appointment.status] || 'Agendada';
                
                const statusClass = {
                    'scheduled': 'blue',
                    'completed': 'green',
                    'not_completed': 'red',
                    'rescheduled': 'orange'
                }[appointment.status] || 'blue';
                
                html += `
                    <div class="activity-item">
                        <div class="activity-icon ${statusClass}">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        <div class="activity-content">
                            <h4>Sessão ${statusText}</h4>
                            <p>${this.formatDateTime(appointment.appointment_date, appointment.appointment_time)} • ${appointment.duration} minutos</p>
                            <p>Tipo: ${this.getAppointmentTypeText(appointment.type)}</p>
                            ${appointment.notes ? `<p>Observações: ${appointment.notes}</p>` : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            
            container.innerHTML = html;
        } catch (error) {
            console.error('Erro ao carregar sessões:', error);
        }
    }

    async loadClinicalNotes(patientId) {
        try {
            const notes = await ApiService.get(`/clinical-notes/${patientId}`);
            const container = document.getElementById('notesTab');
            
            if (!notes || notes.length === 0) {
                container.innerHTML = `
                    <div class="clinical-notes-container">
                        <div class="empty-state" style="padding: 40px 20px;">
                            <i class="fas fa-file-alt"></i>
                            <h4>Nenhuma anotação clínica</h4>
                            <p>Este paciente ainda não tem anotações clínicas registradas</p>
                            <button class="btn" style="margin-top: 20px;" id="newClinicalNoteBtn">
                                <i class="fas fa-plus"></i> Criar Primeira Anotação
                            </button>
                        </div>
                    </div>
                `;
                
                document.getElementById('newClinicalNoteBtn')?.addEventListener('click', () => {
                    this.openClinicalNoteModal(patientId);
                });
                return;
            }
            
            let html = `
                <div class="clinical-notes-container">
                    <div style="margin-bottom: 20px; display: flex; justify-content: flex-end;">
                        <button class="btn" id="newClinicalNoteBtn">
                            <i class="fas fa-plus"></i> Nova Anotação
                        </button>
                    </div>
                    <div class="notes-list">
            `;
            
            notes.forEach(note => {
                html += `
                    <div class="note-item" data-id="${note.id}">
                        <div class="note-header">
                            <h4>${note.title}</h4>
                            <div class="note-actions">
                                <button class="action-btn edit-note-btn" data-id="${note.id}" title="Editar anotação">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn delete delete-note-btn" data-id="${note.id}" title="Excluir anotação">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="note-date">${this.formatDate(note.note_date)}</div>
                        <div class="note-content">${note.content}</div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
            
            // Configurar eventos
            document.getElementById('newClinicalNoteBtn').addEventListener('click', () => {
                this.openClinicalNoteModal(patientId);
            });
            
            container.querySelectorAll('.edit-note-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const noteId = parseInt(btn.getAttribute('data-id'));
                    this.editClinicalNote(noteId);
                });
            });
            
            container.querySelectorAll('.delete-note-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const noteId = parseInt(btn.getAttribute('data-id'));
                    this.deleteClinicalNote(noteId);
                });
            });
            
        } catch (error) {
            console.error('Erro ao carregar anotações:', error);
        }
    }

    async loadPatientFinance(patientId) {
        try {
            const payments = await ApiService.get('/payments');
            const patientPayments = payments.filter(p => p.patient_id === patientId);
            const container = document.getElementById('financeTab');
            
            const totalPaid = patientPayments.reduce((sum, payment) => sum + payment.amount, 0);
            
            if (patientPayments.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 40px 20px;">
                        <i class="fas fa-dollar-sign"></i>
                        <h4>Nenhum pagamento registrado</h4>
                        <p>Este paciente ainda não tem pagamentos registrados</p>
                        <p style="margin-top: 10px; font-weight: 600;">Total pago: R$ 0,00</p>
                    </div>
                `;
                return;
            }
            
            let html = `
                <div class="summary-card" style="margin-bottom: 30px;">
                    <div class="summary-label">Total Pago pelo Paciente</div>
                    <div class="summary-value">R$ ${totalPaid.toFixed(2)}</div>
                </div>
                <div class="activity-list">
            `;
            
            patientPayments.forEach(payment => {
                const typeText = {
                    'session': 'Sessão Individual',
                    'package': 'Pacote Mensal',
                    'assessment': 'Avaliação',
                    'other': 'Outro'
                }[payment.payment_type] || 'Pagamento';
                
                html += `
                    <div class="activity-item">
                        <div class="activity-icon purple">
                            <i class="fas fa-dollar-sign"></i>
                        </div>
                        <div class="activity-content">
                            <h4>${typeText}</h4>
                            <p>Valor: R$ ${payment.amount.toFixed(2)}</p>
                            <p>Data: ${this.formatDate(payment.payment_date)}</p>
                            ${payment.description ? `<p>Descrição: ${payment.description}</p>` : ''}
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            console.error('Erro ao carregar finanças:', error);
        }
    }

    setupPatientTabs() {
        const tabs = document.querySelectorAll('.patient-tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === tabId + 'Tab') {
                        content.classList.add('active');
                    }
                });
            });
        });
    }

    async deletePatient(patientId) {
        this.showConfirmModal(
            'Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.',
            async () => {
                try {
                    await ApiService.delete(`/patients/${patientId}`);
                    
                    await this.loadPatientsList();
                    await this.loadDashboard();
                    await this.loadAgenda();
                    
                    document.getElementById('emptyPatientDetail').classList.remove('hidden');
                    document.getElementById('patientDetail').classList.add('hidden');
                    
                    this.showNotification('Paciente excluído com sucesso!', 'success');
                } catch (error) {
                    this.showNotification('Erro ao excluir paciente.', 'error');
                }
            }
        );
    }

    async editPatient(patientId) {
        try {
            const patients = await ApiService.get('/patients');
            const patient = patients.find(p => p.id === patientId);
            if (!patient) return;
            
            this.editingPatientId = patientId;
            
            document.getElementById('patientModalTitle').textContent = 'Editar Paciente';
            document.getElementById('patientFirstName').value = patient.first_name;
            document.getElementById('patientLastName').value = patient.last_name;
            document.getElementById('patientBirthDateInput').value = patient.birth_date;
            document.getElementById('patientGender').value = patient.gender;
            document.getElementById('patientCPFInput').value = patient.cpf || '';
            document.getElementById('patientPhoneInput').value = patient.phone || '';
            document.getElementById('patientEmailInput').value = patient.email || '';
            document.getElementById('patientSubmitBtn').textContent = 'Atualizar Paciente';
            
            document.getElementById('patientModal').classList.add('active');
        } catch (error) {
            this.showNotification('Erro ao carregar paciente.', 'error');
        }
    }

    async loadAgenda() {
        try {
            const dateStr = this.currentDate.toISOString().split('T')[0];
            const appointments = await ApiService.get(`/appointments?date=${dateStr}`);
            
            const agendaDay = document.getElementById('agendaDay');
            const emptyAgenda = document.getElementById('emptyAgenda');
            
            if (!appointments || appointments.length === 0) {
                agendaDay.innerHTML = '';
                emptyAgenda.classList.remove('hidden');
                return;
            }
            
            emptyAgenda.classList.add('hidden');
            
            // Gerar agenda das 8h às 19h
            let timeColumnHTML = '';
            let appointmentsColumnHTML = '<div class="appointments-column">';
            
            for (let hour = 8; hour <= 19; hour++) {
                timeColumnHTML += `<div class="time-slot-label">${hour.toString().padStart(2, '0')}:00</div>`;
                appointmentsColumnHTML += `<div class="appointment-slot" id="slot-${hour}-00"></div>`;
                
                if (hour < 19) {
                    timeColumnHTML += `<div class="time-slot-label">${hour.toString().padStart(2, '0')}:30</div>`;
                    appointmentsColumnHTML += `<div class="appointment-slot" id="slot-${hour}-30"></div>`;
                }
            }
            
            appointmentsColumnHTML += '</div>';
            agendaDay.innerHTML = `
                <div class="time-column">${timeColumnHTML}</div>
                ${appointmentsColumnHTML}
            `;
            
            // Adicionar consultas
            appointments.forEach(appointment => {
                const [hour, minute] = appointment.appointment_time.split(':').map(Number);
                const duration = appointment.duration;
                
                const startMinutes = hour * 60 + minute;
                const startPosition = (startMinutes - 8 * 60) / 30;
                const heightUnits = duration / 30;
                
                const slotId = `slot-${hour.toString().padStart(2, '0')}-${minute.toString().padStart(2, '0')}`;
                const slot = document.getElementById(slotId);
                
                if (slot) {
                    const appointmentElement = document.createElement('div');
                    appointmentElement.className = `appointment ${appointment.status === 'completed' ? 'green' : 
                                                   appointment.status === 'not_completed' ? 'red' : 
                                                   appointment.status === 'rescheduled' ? 'orange' : 'blue'}`;
                    appointmentElement.style.top = `${startPosition * 80}px`;
                    appointmentElement.style.height = `${heightUnits * 80 - 10}px`;
                    
                    appointmentElement.innerHTML = `
                        <div class="appointment-header">
                            <div class="appointment-time">${appointment.appointment_time}</div>
                            <div>${this.getAppointmentStatusText(appointment.status)}</div>
                        </div>
                        <div class="appointment-patient">${appointment.first_name} ${appointment.last_name}</div>
                        <div class="appointment-type">${this.getAppointmentTypeText(appointment.type)} • ${duration} min</div>
                    `;
                    
                    appointmentElement.addEventListener('click', () => {
                        this.currentAppointmentId = appointment.id;
                        this.openStatusModal(appointment);
                    });
                    
                    slot.appendChild(appointmentElement);
                }
            });
            
        } catch (error) {
            console.error('Erro ao carregar agenda:', error);
        }
    }

    updateAgendaDate() {
        const display = document.getElementById('agendaDateDisplay');
        if (!display) return;
        
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        display.textContent = this.currentDate.toLocaleDateString('pt-BR', options);
    }

    async openAppointmentModal() {
        try {
            // Carregar pacientes
            const patients = await ApiService.get('/patients');
            const select = document.getElementById('appointmentPatient');
            select.innerHTML = '<option value="">Selecione um paciente</option>';
            
            patients.forEach(patient => {
                const option = document.createElement('option');
                option.value = patient.id;
                option.textContent = `${patient.first_name} ${patient.last_name}`;
                select.appendChild(option);
            });
            
            // Configurar data e hora
            const now = new Date();
            document.getElementById('appointmentDate').value = now.toISOString().split('T')[0];
            document.getElementById('appointmentTime').value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            document.getElementById('appointmentModal').classList.add('active');
        } catch (error) {
            this.showNotification('Erro ao abrir modal de consulta.', 'error');
        }
    }

    openStatusModal(appointment) {
        document.getElementById('statusAppointmentInfo').textContent = 
            `Consulta com ${appointment.first_name} ${appointment.last_name} em ${this.formatDate(appointment.appointment_date)} às ${appointment.appointment_time}`;
        document.getElementById('statusModal').classList.add('active');
    }

    async markAppointmentStatus(status) {
        try {
            await ApiService.put(`/appointments/${this.currentAppointmentId}/status`, { status });
            
            await this.loadAgenda();
            await this.loadDashboard();
            
            document.getElementById('statusModal').classList.remove('active');
            
            const statusText = {
                'completed': 'realizada',
                'not_completed': 'não realizada',
                'rescheduled': 'reagendada'
            }[status] || 'atualizada';
            
            this.showNotification(`Consulta marcada como ${statusText}!`, 'success');
            
        } catch (error) {
            this.showNotification('Erro ao atualizar status.', 'error');
        }
    }

    async loadReportsList() {
        try {
            const reports = await ApiService.get('/reports');
            const reportsList = document.getElementById('reportsList');
            const emptyReports = document.getElementById('emptyReports');
            
            if (!reports || reports.length === 0) {
                reportsList.innerHTML = '';
                emptyReports.classList.remove('hidden');
                return;
            }
            
            emptyReports.classList.add('hidden');
            reportsList.innerHTML = '';
            
            reports.forEach(report => {
                const reportItem = document.createElement('div');
                reportItem.className = 'report-item';
                
                const typeText = {
                    'session': 'Relatório de Sessão',
                    'evolution': 'Relatório de Evolução',
                    'assessment': 'Avaliação',
                    'discharge': 'Alta'
                }[report.report_type] || 'Relatório';
                
                reportItem.innerHTML = `
                    <div class="report-header">
                        <div class="report-title">${report.title}</div>
                        <div class="report-date">${this.formatDate(report.report_date)}</div>
                    </div>
                    <div class="report-content">
                        <p><strong>Paciente:</strong> ${report.first_name} ${report.last_name}</p>
                        <p><strong>Tipo:</strong> ${typeText}</p>
                        <p>${report.content.substring(0, 150)}${report.content.length > 150 ? '...' : ''}</p>
                    </div>
                    <div class="report-footer">
                        <div class="report-author">Por ${report.author_name}</div>
                        <div class="report-actions">
                            <button class="btn btn-secondary view-report-btn" data-id="${report.id}">
                                <i class="fas fa-eye"></i> Ver
                            </button>
                            <button class="btn btn-danger delete-report-btn" data-id="${report.id}">
                                <i class="fas fa-trash"></i> Excluir
                            </button>
                        </div>
                    </div>
                `;
                
                reportItem.querySelector('.view-report-btn').addEventListener('click', () => {
                    this.viewReport(report.id);
                });
                
                reportItem.querySelector('.delete-report-btn').addEventListener('click', () => {
                    this.deleteReport(report.id);
                });
                
                reportsList.appendChild(reportItem);
            });
            
        } catch (error) {
            console.error('Erro ao carregar relatórios:', error);
        }
    }

    async updateFinanceSummary() {
        try {
            const stats = await ApiService.get('/dashboard');
            
            document.getElementById('totalBalance').textContent = `R$ ${(stats.monthlyRevenue || 0).toFixed(2)}`;
            document.getElementById('monthBalance').textContent = `R$ ${(stats.monthlyRevenue || 0).toFixed(2)}`;
            document.getElementById('weekBalance').textContent = `R$ ${((stats.monthlyRevenue || 0) / 4).toFixed(2)}`;
            
            // Carregar pacientes para o select
            const patients = await ApiService.get('/patients');
            const select = document.getElementById('paymentPatient');
            select.innerHTML = '<option value="">Selecione um paciente</option>';
            
            patients.forEach(patient => {
                const option = document.createElement('option');
                option.value = patient.id;
                option.textContent = `${patient.first_name} ${patient.last_name}`;
                select.appendChild(option);
            });
            
        } catch (error) {
            console.error('Erro ao atualizar resumo financeiro:', error);
        }
    }

    async loadFolders(type) {
        try {
            const folders = await ApiService.get(`/folders?folder_type=${type}`);
            
            if (type === 'files') {
                const foldersGrid = document.getElementById('foldersGrid');
                const emptyFiles = document.getElementById('emptyFiles');
                const filesContent = document.getElementById('filesContent');
                
                if (!folders || folders.length === 0) {
                    foldersGrid.innerHTML = '';
                    emptyFiles.classList.remove('hidden');
                    filesContent.classList.add('hidden');
                } else {
                    emptyFiles.classList.add('hidden');
                    filesContent.classList.remove('hidden');
                    foldersGrid.innerHTML = '';
                    
                    folders.forEach(folder => {
                        const folderItem = document.createElement('div');
                        folderItem.className = 'folder-item';
                        folderItem.setAttribute('data-id', folder.id);
                        
                        // Contar documentos na pasta
                        ApiService.get(`/documents?folder_id=${folder.id}`).then(documents => {
                            folderItem.innerHTML = `
                                <i class="fas fa-folder"></i>
                                <div class="folder-name">${folder.folder_name}</div>
                                <div class="folder-count">${documents.length} arquivos</div>
                            `;
                        }).catch(() => {
                            folderItem.innerHTML = `
                                <i class="fas fa-folder"></i>
                                <div class="folder-name">${folder.folder_name}</div>
                                <div class="folder-count">0 arquivos</div>
                            `;
                        });
                        
                        folderItem.addEventListener('click', async () => {
                            await this.openFolder(folder.id, type);
                        });
                        
                        foldersGrid.appendChild(folderItem);
                    });
                }
            } else {
                const documentsGrid = document.getElementById('documentsGrid');
                const emptyDocuments = document.getElementById('emptyDocuments');
                const documentsContent = document.getElementById('documentsContent');
                
                if (!folders || folders.length === 0) {
                    documentsGrid.innerHTML = '';
                    emptyDocuments.classList.remove('hidden');
                    documentsContent.classList.add('hidden');
                } else {
                    emptyDocuments.classList.add('hidden');
                    documentsContent.classList.remove('hidden');
                    documentsGrid.innerHTML = '';
                    
                    folders.forEach(folder => {
                        const folderItem = document.createElement('div');
                        folderItem.className = 'folder-item';
                        folderItem.setAttribute('data-id', folder.id);
                        
                        // Contar documentos na pasta
                        ApiService.get(`/documents?folder_id=${folder.id}`).then(documents => {
                            folderItem.innerHTML = `
                                <i class="fas fa-folder"></i>
                                <div class="folder-name">${folder.folder_name}</div>
                                <div class="folder-count">${documents.length} documentos</div>
                            `;
                        }).catch(() => {
                            folderItem.innerHTML = `
                                <i class="fas fa-folder"></i>
                                <div class="folder-name">${folder.folder_name}</div>
                                <div class="folder-count">0 documentos</div>
                            `;
                        });
                        
                        folderItem.addEventListener('click', async () => {
                            await this.openFolder(folder.id, type);
                        });
                        
                        documentsGrid.appendChild(folderItem);
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar pastas:', error);
        }
    }

    async openFolder(folderId, type) {
        this.currentFolderId = folderId;
        this.currentFolderType = type;
        
        if (type === 'files') {
            document.getElementById('foldersGrid').classList.add('hidden');
            document.getElementById('filesListContainer').classList.remove('hidden');
            await this.loadFolderFiles(folderId);
        } else {
            document.getElementById('documentsGrid').classList.add('hidden');
            document.getElementById('documentsListContainer').classList.remove('hidden');
            await this.loadFolderDocuments(folderId);
        }
    }

    async loadFolderFiles(folderId) {
        try {
            const documents = await ApiService.get(`/documents?folder_id=${folderId}`);
            const container = document.getElementById('filesListContainer');
            
            if (!documents || documents.length === 0) {
                container.innerHTML = `
                    <div class="folder-view-container">
                        <div class="folder-view-header">
                            <button class="btn btn-secondary back-btn" id="backToFoldersBtn">
                                <i class="fas fa-arrow-left"></i> Voltar
                            </button>
                            <i class="fas fa-folder"></i>
                            <h3>Pasta Vazia</h3>
                        </div>
                        <div class="empty-state" style="padding: 40px 20px;">
                            <i class="fas fa-folder-open"></i>
                            <h4>Nenhum arquivo nesta pasta</h4>
                            <p>Adicione arquivos a esta pasta</p>
                        </div>
                    </div>
                `;
            } else {
                const folder = await ApiService.get(`/folders`).then(folders => 
                    folders.find(f => f.id == folderId)
                );
                
                let html = `
                    <div class="folder-view-container">
                        <div class="folder-view-header">
                            <button class="btn btn-secondary back-btn" id="backToFoldersBtn">
                                <i class="fas fa-arrow-left"></i> Voltar
                            </button>
                            <i class="fas fa-folder"></i>
                            <h3>${folder?.folder_name || 'Pasta'}</h3>
                        </div>
                        <div class="files-list">
                `;
                
                documents.forEach(doc => {
                    const fileTypeClass = this.getFileTypeClass(doc.mime_type);
                    const fileIcon = this.getFileIcon(doc.mime_type);
                    
                    html += `
                        <div class="file-item" data-id="${doc.id}">
                            <div class="file-icon ${fileTypeClass}">
                                <i class="fas ${fileIcon}"></i>
                            </div>
                            <div class="file-info">
                                <div class="file-name">${doc.document_name}</div>
                                <div class="file-size">${this.formatFileSize(doc.file_size)}</div>
                                ${doc.description ? `<div class="file-description">${doc.description}</div>` : ''}
                            </div>
                            <div class="file-date">${this.formatDate(doc.created_at)}</div>
                            <div class="file-actions">
                                <button class="action-btn download-file-btn" data-id="${doc.id}" title="Download">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="action-btn delete delete-file-btn" data-id="${doc.id}" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
                
                container.innerHTML = html;
                
                // Configurar eventos
                document.getElementById('backToFoldersBtn').addEventListener('click', async () => {
                    await this.closeFolderView();
                });
                
                container.querySelectorAll('.download-file-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const fileId = parseInt(btn.getAttribute('data-id'));
                        await this.downloadFile(fileId);
                    });
                });
                
                container.querySelectorAll('.delete-file-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const fileId = parseInt(btn.getAttribute('data-id'));
                        await this.deleteDocument(fileId);
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar arquivos:', error);
            this.showNotification('Erro ao carregar arquivos da pasta.', 'error');
        }
    }

    async loadFolderDocuments(folderId) {
        try {
            const documents = await ApiService.get(`/documents?folder_id=${folderId}`);
            const container = document.getElementById('documentsListContainer');
            
            if (!documents || documents.length === 0) {
                container.innerHTML = `
                    <div class="folder-view-container">
                        <div class="folder-view-header">
                            <button class="btn btn-secondary back-btn" id="backToFoldersBtn">
                                <i class="fas fa-arrow-left"></i> Voltar
                            </button>
                            <i class="fas fa-folder"></i>
                            <h3>Pasta Vazia</h3>
                        </div>
                        <div class="empty-state" style="padding: 40px 20px;">
                            <i class="fas fa-file-alt"></i>
                            <h4>Nenhum documento nesta pasta</h4>
                            <p>Adicione documentos a esta pasta</p>
                        </div>
                    </div>
                `;
            } else {
                const folder = await ApiService.get(`/folders`).then(folders => 
                    folders.find(f => f.id == folderId)
                );
                
                let html = `
                    <div class="folder-view-container">
                        <div class="folder-view-header">
                            <button class="btn btn-secondary back-btn" id="backToFoldersBtn">
                                <i class="fas fa-arrow-left"></i> Voltar
                            </button>
                            <i class="fas fa-folder"></i>
                            <h3>${folder?.folder_name || 'Pasta'}</h3>
                        </div>
                        <div class="documents-list">
                `;
                
                documents.forEach(doc => {
                    html += `
                        <div class="file-item" data-id="${doc.id}">
                            <div class="file-icon document">
                                <i class="fas fa-file-alt"></i>
                            </div>
                            <div class="file-info">
                                <div class="file-name">${doc.document_name}</div>
                                <div class="file-description">${doc.description || ''}</div>
                            </div>
                            <div class="file-date">${this.formatDate(doc.created_at)}</div>
                            <div class="file-actions">
                                <button class="action-btn view-doc-btn" data-id="${doc.id}" title="Visualizar">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="action-btn delete delete-doc-btn" data-id="${doc.id}" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
                
                container.innerHTML = html;
                
                // Configurar eventos
                document.getElementById('backToFoldersBtn').addEventListener('click', async () => {
                    await this.closeFolderView();
                });
                
                container.querySelectorAll('.view-doc-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const docId = parseInt(btn.getAttribute('data-id'));
                        const doc = documents.find(d => d.id === docId);
                        if (doc) {
                            this.viewDocument(doc);
                        }
                    });
                });
                
                container.querySelectorAll('.delete-doc-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const docId = parseInt(btn.getAttribute('data-id'));
                        await this.deleteDocument(docId);
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar documentos:', error);
            this.showNotification('Erro ao carregar documentos da pasta.', 'error');
        }
    }

    async closeFolderView() {
        this.currentFolderId = null;
        this.currentFolderType = null;
        
        if (document.getElementById('filesPage').classList.contains('active')) {
            document.getElementById('filesListContainer').classList.add('hidden');
            document.getElementById('foldersGrid').classList.remove('hidden');
            await this.loadFolders('files');
        } else if (document.getElementById('documentsPage').classList.contains('active')) {
            document.getElementById('documentsListContainer').classList.add('hidden');
            document.getElementById('documentsGrid').classList.remove('hidden');
            await this.loadFolders('documents');
        }
    }

    async downloadFile(fileId) {
        try {
            // Implementar download do arquivo
            this.showNotification('Download iniciado...', 'info');
            
            // Em produção, usar a URL do arquivo
            // window.open(`/uploads/${fileName}`, '_blank');
            
        } catch (error) {
            console.error('Erro ao fazer download:', error);
            this.showNotification('Erro ao fazer download do arquivo.', 'error');
        }
    }

    async deleteDocument(docId) {
        this.showConfirmModal(
            'Tem certeza que deseja excluir este documento?',
            async () => {
                try {
                    // Implementar exclusão de documento
                    this.showNotification('Documento excluído com sucesso!', 'success');
                    await this.closeFolderView();
                } catch (error) {
                    this.showNotification('Erro ao excluir documento.', 'error');
                }
            }
        );
    }

    // Funções utilitárias
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    formatDateTime(dateString, timeString) {
        const date = new Date(dateString);
        return `${date.toLocaleDateString('pt-BR')} às ${timeString}`;
    }

    formatCPF(cpf) {
        if (!cpf) return '';
        cpf = cpf.replace(/\D/g, '');
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    calculateAge(birthDateString) {
        const birthDate = new Date(birthDateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    getAppointmentTypeText(type) {
        return {
            'individual': 'Individual',
            'couple': 'Casal',
            'family': 'Familiar',
            'assessment': 'Avaliação',
            'emergency': 'Emergência'
        }[type] || 'Individual';
    }

    getAppointmentStatusText(status) {
        return {
            'scheduled': 'Agendada',
            'completed': 'Realizada',
            'not_completed': 'Não Realizada',
            'rescheduled': 'Reagendada'
        }[status] || 'Agendada';
    }

    getFileTypeClass(type) {
        if (type?.includes('pdf')) return 'pdf';
        if (type?.includes('image')) return 'image';
        if (type?.includes('text') || type?.includes('document')) return 'document';
        return 'other';
    }

    getFileIcon(type) {
        if (type?.includes('pdf')) return 'fa-file-pdf';
        if (type?.includes('image')) return 'fa-file-image';
        if (type?.includes('text') || type?.includes('document')) return 'fa-file-alt';
        return 'fa-file';
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 Bytes';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Notificações e modais
    showNotification(message, type = 'success') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}"></i>
            </div>
            <div class="notification-content">
                <h4>${type === 'success' ? 'Sucesso!' : type === 'error' ? 'Erro!' : 'Aviso!'}</h4>
                <p>${message}</p>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => notification.classList.add('active'), 10);
        
        setTimeout(() => {
            notification.classList.remove('active');
            setTimeout(() => notification.remove(), 400);
        }, 5000);
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('active');
            setTimeout(() => notification.remove(), 400);
        });
    }

    showConfirmModal(message, onConfirm) {
        const modal = document.getElementById('confirmModal');
        if (!modal) return;
        
        document.getElementById('confirmMessage').textContent = message;
        
        modal.classList.add('active');
        
        document.getElementById('confirmOk').onclick = () => {
            modal.classList.remove('active');
            onConfirm();
        };
        
        document.getElementById('confirmCancel').onclick = () => {
            modal.classList.remove('active');
        };
    }

    viewDocument(doc) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>${doc.document_name}</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="white-space: pre-wrap; padding: 20px; background-color: var(--light-bg); border-radius: var(--border-radius-sm); max-height: 400px; overflow-y: auto;">
                        ${doc.description || 'Conteúdo do documento'}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary close-doc-view">Fechar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.querySelector('.close-doc-view').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    setupModals() {
        // Configurar fechamento de modais
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', function() {
                this.closest('.modal-overlay').classList.remove('active');
            });
        });
        
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Cancelar formulários
        const cancelButtons = {
            'cancelAppointment': 'appointmentModal',
            'cancelPatient': 'patientModal',
            'cancelReport': 'reportModal',
            'cancelStatus': 'statusModal',
            'cancelFolder': 'newFolderModal',
            'cancelDocument': 'newDocumentModal',
            'cancelUpload': 'uploadFileModal',
            'cancelNote': 'noteModal'
        };
        
        Object.entries(cancelButtons).forEach(([btnId, modalId]) => {
            document.getElementById(btnId)?.addEventListener('click', () => {
                document.getElementById(modalId).classList.remove('active');
                if (btnId === 'cancelPatient') this.editingPatientId = null;
                if (btnId === 'cancelNote') this.editingNoteId = null;
            });
        });
        
        // Configurar formulário de paciente
        const patientForm = document.getElementById('patientForm');
        if (patientForm) {
            patientForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const patientData = {
                    first_name: document.getElementById('patientFirstName').value.trim(),
                    last_name: document.getElementById('patientLastName').value.trim(),
                    birth_date: document.getElementById('patientBirthDateInput').value,
                    gender: document.getElementById('patientGender').value,
                    cpf: document.getElementById('patientCPFInput').value,
                    phone: document.getElementById('patientPhoneInput').value,
                    email: document.getElementById('patientEmailInput').value,
                    session_frequency: 'weekly',
                    therapy_reason: 'A ser definido na primeira sessão'
                };
                
                try {
                    if (this.editingPatientId) {
                        await ApiService.put(`/patients/${this.editingPatientId}`, patientData);
                        this.showNotification('Paciente atualizado com sucesso!', 'success');
                    } else {
                        await ApiService.post('/patients', patientData);
                        this.showNotification('Paciente cadastrado com sucesso!', 'success');
                    }
                    
                    await this.loadPatientsList();
                    await this.loadDashboard();
                    
                    document.getElementById('patientModal').classList.remove('active');
                    patientForm.reset();
                    this.editingPatientId = null;
                    
                } catch (error) {
                    this.showNotification('Erro ao salvar paciente.', 'error');
                }
            });
        }
        
        // Configurar formulário de consulta
        const appointmentForm = document.getElementById('appointmentForm');
        if (appointmentForm) {
            appointmentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const appointmentData = {
                    patient_id: parseInt(document.getElementById('appointmentPatient').value),
                    appointment_date: document.getElementById('appointmentDate').value,
                    appointment_time: document.getElementById('appointmentTime').value,
                    duration: parseInt(document.getElementById('appointmentDuration').value),
                    type: document.getElementById('appointmentType').value,
                    notes: document.getElementById('appointmentNotes').value
                };
                
                // Validar horário para o mesmo dia
                const today = new Date().toISOString().split('T')[0];
                const [hours, minutes] = appointmentData.appointment_time.split(':').map(Number);
                const appointmentDateTime = new Date(`${appointmentData.appointment_date}T${appointmentData.appointment_time}`);
                
                if (appointmentData.appointment_date === today) {
                    const now = new Date();
                    if (appointmentDateTime < now) {
                        this.showNotification('Não é possível agendar consultas para horários passados no mesmo dia.', 'error');
                        return;
                    }
                }
                
                try {
                    await ApiService.post('/appointments', appointmentData);
                    
                    await this.loadAgenda();
                    await this.loadDashboard();
                    
                    document.getElementById('appointmentModal').classList.remove('active');
                    appointmentForm.reset();
                    
                    const now = new Date();
                    document.getElementById('appointmentDate').value = now.toISOString().split('T')[0];
                    document.getElementById('appointmentTime').value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    document.getElementById('appointmentDuration').value = 50;
                    
                    this.showNotification('Consulta agendada com sucesso!', 'success');
                    
                } catch (error) {
                    this.showNotification('Erro ao agendar consulta.', 'error');
                }
            });
        }
        
        // Botões do modal de status
        document.getElementById('markCompleted')?.addEventListener('click', async () => {
            await this.markAppointmentStatus('completed');
        });
        
        document.getElementById('markNotCompleted')?.addEventListener('click', async () => {
            await this.markAppointmentStatus('not_completed');
        });
        
        document.getElementById('markRescheduled')?.addEventListener('click', () => {
            this.showNotification('Funcionalidade de reagendamento em desenvolvimento.', 'info');
            document.getElementById('statusModal').classList.remove('active');
        });
    }

    openPatientModal() {
        const form = document.getElementById('patientForm');
        if (!form) return;
        
        form.reset();
        this.editingPatientId = null;
        document.getElementById('patientModalTitle').textContent = 'Novo Paciente';
        document.getElementById('patientSubmitBtn').textContent = 'Salvar Paciente';
        
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - 120);
        document.getElementById('patientBirthDateInput').max = new Date().toISOString().split('T')[0];
        document.getElementById('patientBirthDateInput').min = minDate.toISOString().split('T')[0];
        
        document.getElementById('patientModal').classList.add('active');
        document.getElementById('patientFirstName').focus();
    }

    openClinicalNoteModal(patientId, noteId = null) {
        this.editingNoteId = noteId;
        
        const form = document.getElementById('noteForm');
        if (!form) return;
        
        form.reset();
        
        if (noteId) {
            document.getElementById('noteModalTitle').textContent = 'Editar Anotação Clínica';
            document.getElementById('noteSubmitBtn').textContent = 'Atualizar Anotação';
            // Carregar dados da anotação existente
        } else {
            document.getElementById('noteModalTitle').textContent = 'Nova Anotação Clínica';
            document.getElementById('noteSubmitBtn').textContent = 'Salvar Anotação';
            document.getElementById('noteDate').value = new Date().toISOString().split('T')[0];
        }
        
        document.getElementById('notePatientId').value = patientId;
        document.getElementById('noteModal').classList.add('active');
    }

    async editClinicalNote(noteId) {
        this.showNotification('Funcionalidade de edição em desenvolvimento.', 'info');
    }

    async deleteClinicalNote(noteId) {
        this.showConfirmModal(
            'Tem certeza que deseja excluir esta anotação clínica?',
            async () => {
                this.showNotification('Anotação excluída com sucesso!', 'success');
            }
        );
    }

    async viewReport(reportId) {
        this.showNotification('Funcionalidade de visualização em desenvolvimento.', 'info');
    }

    async deleteReport(reportId) {
        this.showConfirmModal(
            'Tem certeza que deseja excluir este relatório?',
            async () => {
                this.showNotification('Relatório excluído com sucesso!', 'success');
            }
        );
    }
}

// Inicializar sistema quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.psicoFlowSystem = new PsicoFlowSystem();
    window.psicoFlowSystem.init();
});
