class PsicogestaoApp {
    constructor() {
        this.API_URL = 'http://localhost:3000/api';
        this.token = null;
        this.user = null;
        this.currentPatientId = null;
        
        this.initialize();
    }
    
    async initialize() {
        // Verificar token na sessão
        this.token = sessionStorage.getItem('psicogestao_token');
        this.user = JSON.parse(sessionStorage.getItem('psicogestao_user') || 'null');
        
        if (this.token && this.user) {
            // Verificar se o token ainda é válido
            if (await this.validateToken()) {
                this.showMainSystem();
                await this.loadInitialData();
            } else {
                this.logout();
            }
        } else {
            this.showLoginScreen();
        }
        
        this.setupEventListeners();
    }
    
    async validateToken() {
        try {
            const response = await fetch(`${this.API_URL}/validate-token`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    async login(username, password) {
        try {
            const response = await fetch(`${this.API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                throw new Error('Credenciais inválidas');
            }
            
            const data = await response.json();
            this.token = data.token;
            this.user = data.user;
            
            // Salvar na sessão (não no localStorage)
            sessionStorage.setItem('psicogestao_token', this.token);
            sessionStorage.setItem('psicogestao_user', JSON.stringify(this.user));
            
            return data;
        } catch (error) {
            throw error;
        }
    }
    
    logout() {
        this.token = null;
        this.user = null;
        sessionStorage.removeItem('psicogestao_token');
        sessionStorage.removeItem('psicogestao_user');
        this.showLoginScreen();
    }
    
    async fetchWithAuth(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };
        
        const response = await fetch(`${this.API_URL}${url}`, {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        });
        
        if (response.status === 401) {
            this.logout();
            throw new Error('Sessão expirada');
        }
        
        return response;
    }
    
    // Métodos para pacientes
    async getPatients() {
        const response = await this.fetchWithAuth('/patients');
        return response.json();
    }
    
    async createPatient(patientData) {
        const response = await this.fetchWithAuth('/patients', {
            method: 'POST',
            body: JSON.stringify(patientData)
        });
        return response.json();
    }
    
    async updatePatient(id, patientData) {
        const response = await this.fetchWithAuth(`/patients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(patientData)
        });
        return response.json();
    }
    
    async deletePatient(id, reason) {
        const response = await this.fetchWithAuth(`/patients/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ deletion_reason: reason })
        });
        return response.json();
    }
    
    // Métodos para consultas
    async getAppointments(date = null) {
        const url = date ? `/appointments?date=${date}` : '/appointments';
        const response = await this.fetchWithAuth(url);
        return response.json();
    }
    
    async createAppointment(appointmentData) {
        const response = await this.fetchWithAuth('/appointments', {
            method: 'POST',
            body: JSON.stringify(appointmentData)
        });
        return response.json();
    }
    
    // Métodos para relatórios
    async getReports(patientId = null) {
        const url = patientId ? `/reports?patientId=${patientId}` : '/reports';
        const response = await this.fetchWithAuth(url);
        return response.json();
    }
    
    async createReport(reportData) {
        const response = await this.fetchWithAuth('/reports', {
            method: 'POST',
            body: JSON.stringify(reportData)
        });
        return response.json();
    }
    
    // Interface
    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainSystem').classList.add('hidden');
    }
    
    showMainSystem() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainSystem').classList.remove('hidden');
        document.getElementById('userNameDisplay').textContent = this.user.fullName;
    }
    
    setupEventListeners() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                await this.login(username, password);
                this.showMainSystem();
                await this.loadInitialData();
                showNotification('Login realizado com sucesso!', 'success');
            } catch (error) {
                showNotification('Credenciais inválidas', 'error');
            }
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
            showNotification('Logout realizado', 'success');
        });
        
        // Novo paciente
        document.getElementById('newPatientBtn').addEventListener('click', () => {
            this.openPatientModal();
        });
    }
    
    async loadInitialData() {
        try {
            // Carregar pacientes
            const patients = await this.getPatients();
            this.renderPatientsList(patients);
            
            // Carregar consultas do dia
            const today = new Date().toISOString().split('T')[0];
            const appointments = await this.getAppointments(today);
            this.renderTodayAppointments(appointments);
            
            // Atualizar dashboard
            this.updateDashboard(patients, appointments);
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }
    
    renderPatientsList(patients) {
        const container = document.getElementById('patientsList');
        container.innerHTML = '';
        
        patients.forEach(patient => {
            const patientElement = this.createPatientElement(patient);
            container.appendChild(patientElement);
        });
    }
    
    createPatientElement(patient) {
        const div = document.createElement('div');
        div.className = 'patient-item';
        div.dataset.id = patient.id;
        
        const initials = patient.first_name.charAt(0) + patient.last_name.charAt(0);
        const age = this.calculateAge(patient.birth_date);
        
        div.innerHTML = `
            <div class="patient-avatar">${initials}</div>
            <div class="patient-info">
                <h4>${patient.first_name} ${patient.last_name}</h4>
                <p><i class="fas fa-user"></i> ${age} anos</p>
                <p><i class="fas fa-calendar"></i> Desde ${this.formatDate(patient.first_session_date)}</p>
                <span class="patient-status ${patient.status === 'active' ? 'status-active' : 'status-inactive'}">
                    ${patient.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            <div class="patient-actions">
                <button class="action-btn edit-patient" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete delete-patient" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Eventos
        div.querySelector('.edit-patient').addEventListener('click', (e) => {
            e.stopPropagation();
            this.editPatient(patient.id);
        });
        
        div.querySelector('.delete-patient').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deletePatientConfirmation(patient.id, `${patient.first_name} ${patient.last_name}`);
        });
        
        div.addEventListener('click', () => {
            this.selectPatient(patient.id);
        });
        
        return div;
    }
    
    async selectPatient(patientId) {
        try {
            const patient = await this.getPatientDetails(patientId);
            this.currentPatientId = patientId;
            this.renderPatientDetails(patient);
        } catch (error) {
            console.error('Erro ao carregar paciente:', error);
        }
    }
    
    async getPatientDetails(patientId) {
        const response = await this.fetchWithAuth(`/patients/${patientId}`);
        return response.json();
    }
    
    openPatientModal(patient = null) {
        const modal = document.getElementById('patientModal');
        const form = document.getElementById('patientForm');
        
        if (patient) {
            document.getElementById('patientModalTitle').textContent = 'Editar Paciente';
            // Preencher formulário com dados do paciente
            document.getElementById('patientFirstName').value = patient.first_name;
            document.getElementById('patientLastName').value = patient.last_name;
            // ... preencher outros campos
        } else {
            document.getElementById('patientModalTitle').textContent = 'Novo Paciente';
            form.reset();
        }
        
        modal.classList.add('active');
    }
    
    deletePatientConfirmation(patientId, patientName) {
        showConfirmModal(
            `Tem certeza que deseja excluir o paciente ${patientName}?`,
            async () => {
                try {
                    await this.deletePatient(patientId, 'Exclusão pelo usuário');
                    await this.loadInitialData();
                    showNotification('Paciente excluído com sucesso', 'success');
                } catch (error) {
                    showNotification('Erro ao excluir paciente', 'error');
                }
            }
        );
    }
    
    // Utilitários
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }
    
    calculateAge(birthDateString) {
        if (!birthDateString) return 0;
        const birthDate = new Date(birthDateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }
}

// Inicializar aplicação
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new PsicogestaoApp();
});