<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PsicoFlow | Sistema de Gestão Psicológica</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        :root {
            --primary-color: #4a6bff;
            --secondary-color: #ff6b9d;
            --accent-color: #6c5ce7;
            --dark-color: #2c3e50;
            --light-bg: #f8f9fa;
            --text-color: #333;
            --white: #ffffff;
            --shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
            --transition: all 0.3s ease;
            --border-radius: 12px;
        }

        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: var(--text-color);
            line-height: 1.6;
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 30px 0;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 15px;
            color: white;
        }

        .logo img {
            height: 60px;
            width: auto;
            border-radius: 12px;
        }

        .logo h1 {
            font-size: 2.5rem;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .logo span {
            color: var(--secondary-color);
        }

        .auth-buttons {
            display: flex;
            gap: 15px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 12px 30px;
            border-radius: 50px;
            font-weight: 600;
            text-decoration: none;
            transition: var(--transition);
            border: 2px solid white;
            color: white;
            background: transparent;
            cursor: pointer;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow);
        }

        .btn-primary {
            background: var(--primary-color);
            border-color: var(--primary-color);
        }

        .btn-whatsapp {
            background: #25D366;
            border-color: #25D366;
        }

        .hero {
            text-align: center;
            padding: 80px 20px;
            color: white;
        }

        .hero h2 {
            font-size: 3.5rem;
            margin-bottom: 20px;
            font-weight: 800;
        }

        .hero p {
            font-size: 1.5rem;
            margin-bottom: 40px;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
            opacity: 0.9;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            padding: 60px 0;
        }

        .feature-card {
            background: white;
            border-radius: var(--border-radius);
            padding: 40px 30px;
            text-align: center;
            box-shadow: var(--shadow);
            transition: var(--transition);
        }

        .feature-card:hover {
            transform: translateY(-10px);
            box-shadow: var(--shadow-lg);
        }

        .feature-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 25px;
            background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 2rem;
        }

        .feature-card h3 {
            font-size: 1.5rem;
            margin-bottom: 15px;
            color: var(--dark-color);
        }

        .feature-card p {
            color: #666;
            font-size: 1.1rem;
        }

        .pricing {
            background: white;
            border-radius: var(--border-radius);
            padding: 60px;
            margin: 60px 0;
            text-align: center;
        }

        .pricing h2 {
            font-size: 2.5rem;
            margin-bottom: 40px;
            color: var(--dark-color);
        }

        .price {
            font-size: 4rem;
            font-weight: 800;
            color: var(--primary-color);
            margin: 30px 0;
        }

        .price span {
            font-size: 1.5rem;
            color: #666;
        }

        .testimonials {
            padding: 80px 0;
            color: white;
        }

        .testimonial-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: var(--border-radius);
            padding: 40px;
            margin: 30px 0;
        }

        .testimonial-card p {
            font-size: 1.2rem;
            margin-bottom: 20px;
            font-style: italic;
        }

        .testimonial-author {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .author-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--secondary-color);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }

        footer {
            text-align: center;
            padding: 40px 0;
            color: white;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            margin-top: 60px;
        }

        .footer-links {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 30px 0;
        }

        .footer-links a {
            color: white;
            text-decoration: none;
            transition: var(--transition);
        }

        .footer-links a:hover {
            color: var(--secondary-color);
        }

        @media (max-width: 768px) {
            .hero h2 {
                font-size: 2.5rem;
            }
            
            .hero p {
                font-size: 1.2rem;
            }
            
            .logo h1 {
                font-size: 2rem;
            }
            
            .features-grid {
                grid-template-columns: 1fr;
            }
            
            .pricing {
                padding: 30px;
            }
            
            .price {
                font-size: 3rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <img src="https://lh3.googleusercontent.com/gg/AIJ2gl_XKNtS7JBrYw43Ab5PgnJzqkBMgo6-F0yGroTH0lNzEZtjqcOmC14j24f4p1yFglkg7IpIjj198CHUydRGfAGMk0hWwZ_BGero-5m45wvpovYM0wbsKl4uBqz41M9caoFJe0mIV0hLRCtaC2442Ejfgh0QepykUgmNe5adCAnd7BsjgFaKS4BQvBCzS_X7jMtIv58JqVlGEUs2I_47GjCW_r4R9MvKNNrCV0RJr8U-pPQLPe1WQz92ddbUYMZMG-G_PodYWHTNzkxBZ92ktGL5eh5B2ldGOQ9uMxlnzBw_SqA019emETZirtCGmJvT8U7L-Fcj2p4jJdqSiBp1gT4=s1024-rj" alt="PsicoFlow Logo">
                <div>
                    <h1>Psico<span>Flow</span></h1>
                    <p style="font-size: 0.9rem; opacity: 0.8; margin-top: 5px;">Gestão Psicológica Inteligente</p>
                </div>
            </div>
            
            <div class="auth-buttons">
                <a href="login.html" class="btn btn-primary">
                    <i class="fas fa-sign-in-alt"></i> Entrar
                </a>
                <a href="https://wa.me/81997985738" class="btn btn-whatsapp" target="_blank">
                    <i class="fab fa-whatsapp"></i> Comprar
                </a>
            </div>
        </header>

        <section class="hero">
            <h2>Transforme Sua Prática Psicológica</h2>
            <p>O sistema completo para gestão de pacientes, agenda, relatórios e muito mais. Tudo em um só lugar, seguro e otimizado para sua produtividade.</p>
            <div style="margin-top: 40px;">
                <a href="login.html" class="btn btn-primary" style="padding: 15px 50px; font-size: 1.2rem;">
                    <i class="fas fa-rocket"></i> Começar Agora
                </a>
            </div>
        </section>

        <section class="features-grid">
            <div class="feature-card">
                <div class="feature-icon">
                    <i class="fas fa-user-injured"></i>
                </div>
                <h3>Gestão de Pacientes</h3>
                <p>Cadastro completo com histórico, anotações clínicas, evolução e documentos. Totalmente seguro e sigiloso.</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-icon">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <h3>Agenda Inteligente</h3>
                <p>Agendamento flexível, lembretes automáticos, controle de horários e status das sessões em tempo real.</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <h3>Relatórios Automáticos</h3>
                <p>Crie relatórios clínicos detalhados com modelos pré-configurados e armazenamento seguro em nuvem.</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-icon">
                    <i class="fas fa-chart-line"></i>
                </div>
                <h3>Financeiro Completo</h3>
                <p>Controle de pagamentos, receitas, pacotes e relatórios financeiros para gestão do seu consultório.</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <h3>Assistente IA</h3>
                <p>Chatbot especializado em psicologia para apoio em questões clínicas, éticas e técnicas.</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-icon">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <h3>Segurança Total</h3>
                <p>Criptografia de ponta a ponta, backups automáticos e conformidade completa com a LGPD.</p>
            </div>
        </section>

        <section class="pricing">
            <h2>Investimento que Transforma</h2>
            <p style="font-size: 1.3rem; margin-bottom: 30px; color: #666;">Todas as funcionalidades por um valor acessível</p>
            
            <div class="price">
                R$ 97<span>/mês</span>
            </div>
            
            <p style="font-size: 1.2rem; margin-bottom: 30px; color: #666;">
                Ou R$ 997/ano (economize 14%)
            </p>
            
            <div style="margin: 40px 0;">
                <ul style="list-style: none; text-align: left; max-width: 600px; margin: 0 auto;">
                    <li style="padding: 10px 0; font-size: 1.1rem;"><i class="fas fa-check" style="color: var(--primary-color); margin-right: 10px;"></i> Gestão ilimitada de pacientes</li>
                    <li style="padding: 10px 0; font-size: 1.1rem;"><i class="fas fa-check" style="color: var(--primary-color); margin-right: 10px;"></i> Agenda inteligente e flexível</li>
                    <li style="padding: 10px 0; font-size: 1.1rem;"><i class="fas fa-check" style="color: var(--primary-color); margin-right: 10px;"></i> Sistema de relatórios completo</li>
                    <li style="padding: 10px 0; font-size: 1.1rem;"><i class="fas fa-check" style="color: var(--primary-color); margin-right: 10px;"></i> Assistente IA especializado</li>
                    <li style="padding: 10px 0; font-size: 1.1rem;"><i class="fas fa-check" style="color: var(--primary-color); margin-right: 10px;"></i> Backup automático diário</li>
                    <li style="padding: 10px 0; font-size: 1.1rem;"><i class="fas fa-check" style="color: var(--primary-color); margin-right: 10px;"></i> Suporte prioritário</li>
                </ul>
            </div>
            
            <a href="https://wa.me/81997985738" class="btn btn-primary" style="padding: 15px 50px; font-size: 1.2rem;">
                <i class="fab fa-whatsapp"></i> Falar com Vendedor
            </a>
        </section>

        <section class="testimonials">
            <h2 style="text-align: center; font-size: 2.5rem; margin-bottom: 50px;">O que dizem os psicólogos</h2>
            
            <div class="testimonial-card">
                <p>"O PsicoFlow transformou completamente minha prática. Antes gastava horas com papelada, agora tudo é automatizado e seguro. A economia de tempo é impressionante!"</p>
                <div class="testimonial-author">
                    <div class="author-avatar">DR</div>
                    <div>
                        <h4>Dra. Renata Silva</h4>
                        <p>Psicóloga Clínica - 8 anos de experiência</p>
                    </div>
                </div>
            </div>
            
            <div class="testimonial-card">
                <p>"Como psicólogo que atende online, a segurança dos dados era minha maior preocupação. O PsicoFlow me dá tranquilidade total, além de ser incrivelmente fácil de usar."</p>
                <div class="testimonial-author">
                    <div class="author-avatar">PS</div>
                    <div>
                        <h4>Dr. Pedro Santos</h4>
                        <p>Psicólogo Online - Especialista em TCC</p>
                    </div>
                </div>
            </div>
        </section>

        <footer>
            <div class="logo" style="justify-content: center; margin-bottom: 30px;">
                <img src="https://lh3.googleusercontent.com/gg/AIJ2gl_XKNtS7JBrYw43Ab5PgnJzqkBMgo6-F0yGroTH0lNzEZtjqcOmC14j24f4p1yFglkg7IpIjj198CHUydRGfAGMk0hWwZ_BGero-5m45wvpovYM0wbsKl4uBqz41M9caoFJe0mIV0hLRCtaC2442Ejfgh0QepykUgmNe5adCAnd7BsjgFaKS4BQvBCzS_X7jMtIv58JqVlGEUs2I_47GjCW_r4R9MvKNNrCV0RJr8U-pPQLPe1WQz92ddbUYMZMG-G_PodYWHTNzkxBZ92ktGL5eh5B2ldGOQ9uMxlnzBw_SqA019emETZirtCGmJvT8U7L-Fcj2p4jJdqSiBp1gT4=s1024-rj" alt="PsicoFlow Logo" style="height: 40px;">
                <h1 style="font-size: 1.8rem;">Psico<span>Flow</span></h1>
            </div>
            
            <div class="footer-links">
                <a href="#"><i class="fas fa-shield-alt"></i> LGPD</a>
                <a href="#"><i class="fas fa-question-circle"></i> Ajuda</a>
                <a href="#"><i class="fas fa-file-contract"></i> Termos</a>
                <a href="#"><i class="fas fa-envelope"></i> Contato</a>
            </div>
            
            <p style="opacity: 0.8; margin-top: 30px;">
                &copy; 2024 PsicoFlow - Sistema de Gestão Psicológica. Todos os direitos reservados.
            </p>
        </footer>
    </div>

    <script>
        // Animações simples
        document.addEventListener('DOMContentLoaded', function() {
            const featureCards = document.querySelectorAll('.feature-card');
            
            featureCards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                
                setTimeout(() => {
                    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 100);
            });
        });
    </script>
</body>
</html>
