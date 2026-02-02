// Configuration
const API_URL = "https://my.moneyfusion.net/697c93c41efb8281bec22b69";
const RETURN_URL = window.location.origin + "/callback.html"; // À créer si nécessaire

// Variables globales
let currentToken = null;
let paymentData = null;

// Initialiser la page
document.addEventListener('DOMContentLoaded', function() {
    updateTotal();
    
    // Ajouter des écouteurs d'événements pour mettre à jour le total
    document.querySelectorAll('.article-price').forEach(input => {
        input.addEventListener('input', updateTotal);
    });
});

// Mettre à jour le total
function updateTotal() {
    let total = 0;
    document.querySelectorAll('.article-price').forEach(input => {
        const price = parseFloat(input.value) || 0;
        total += price;
    });
    document.getElementById('total').value = total;
}

// Ajouter un article
function addArticle() {
    const container = document.getElementById('articles-container');
    const articleDiv = document.createElement('div');
    articleDiv.className = 'article-item';
    articleDiv.innerHTML = `
        <input type="text" class="article-name" placeholder="Nom de l'article">
        <input type="number" class="article-price" placeholder="Prix" min="0">
        <button type="button" class="remove-article" onclick="removeArticle(this)">×</button>
    `;
    container.appendChild(articleDiv);
    
    // Ajouter l'écouteur d'événement pour le nouveau champ de prix
    articleDiv.querySelector('.article-price').addEventListener('input', updateTotal);
}

// Supprimer un article
function removeArticle(button) {
    button.parentElement.remove();
    updateTotal();
}

// Initialiser le paiement
async function initiatePayment() {
    // Réinitialiser les messages d'erreur
    document.getElementById('error-message').style.display = 'none';
    
    // Récupérer les données du formulaire
    const nom = document.getElementById('nom').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const totalPrice = parseFloat(document.getElementById('total').value);
    
    // Validation
    if (!nom || !phone) {
        showError("Veuillez remplir tous les champs obligatoires");
        return;
    }
    
    if (totalPrice <= 0) {
        showError("Le montant total doit être supérieur à 0");
        return;
    }
    
    if (phone.length < 8) {
        showError("Numéro de téléphone invalide");
        return;
    }
    
    // Récupérer les articles
    const articles = [];
    document.querySelectorAll('.article-item').forEach(item => {
        const name = item.querySelector('.article-name').value.trim() || "Article";
        const price = parseFloat(item.querySelector('.article-price').value) || 0;
        if (price > 0) {
            const articleObj = {};
            articleObj[name] = price;
            articles.push(articleObj);
        }
    });
    
    if (articles.length === 0) {
        showError("Veuillez ajouter au moins un article");
        return;
    }
    
    // Préparer les données de paiement
    paymentData = {
        totalPrice: totalPrice,
        article: articles,
        personal_Info: [{
            userId: document.getElementById('userId').value.trim() || "0",
            orderId: document.getElementById('orderId').value.trim() || Date.now().toString()
        }],
        numeroSend: phone,
        nomclient: nom,
        return_url: RETURN_URL,
        webhook_url: window.location.origin + "/webhook.html" // À créer si nécessaire
    };
    
    // Afficher le modal de confirmation
    document.getElementById('modal-nom').textContent = nom;
    document.getElementById('modal-phone').textContent = phone;
    document.getElementById('modal-amount').textContent = totalPrice.toLocaleString();
    document.getElementById('payment-modal').style.display = 'flex';
}

// Rediriger vers le paiement
async function redirectToPayment() {
    const button = document.querySelector('.btn-pay');
    const buttonText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.loading-spinner');
    
    // Afficher le spinner
    button.disabled = true;
    buttonText.style.display = 'none';
    spinner.style.display = 'block';
    
    try {
        // Envoyer la requête à l'API MoneyFusion
        const response = await axios.post(API_URL, paymentData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.status) {
            // Sauvegarder le token pour vérification ultérieure
            currentToken = response.data.token;
            localStorage.setItem('paymentToken', currentToken);
            localStorage.setItem('paymentData', JSON.stringify(paymentData));
            
            // Rediriger vers la page de paiement MoneyFusion
            window.location.href = response.data.url;
        } else {
            throw new Error(response.data.message || "Erreur lors de l'initialisation du paiement");
        }
    } catch (error) {
        console.error('Erreur:', error);
        
        // Afficher l'erreur dans le modal
        document.getElementById('modal-error').textContent = 
            error.response?.data?.message || error.message || "Une erreur est survenue";
        document.getElementById('modal-error').style.display = 'block';
        
        // Réinitialiser le bouton
        button.disabled = false;
        buttonText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Fermer le modal
function closeModal() {
    document.getElementById('payment-modal').style.display = 'none';
    document.getElementById('modal-error').style.display = 'none';
    
    // Réinitialiser le bouton de paiement
    const button = document.querySelector('.btn-pay');
    const buttonText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.loading-spinner');
    button.disabled = false;
    buttonText.style.display = 'inline';
    spinner.style.display = 'none';
}

// Afficher une erreur
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.scrollIntoView({ behavior: 'smooth' });
}

// Fonction pour vérifier le statut du paiement (à appeler depuis la page de retour)
async function checkPaymentStatus(token) {
    if (!token) return null;
    
    try {
        const response = await axios.get(
            `https://www.pay.moneyfusion.net/paiementNotif/${token}`
        );
        return response.data;
    } catch (error) {
        console.error('Erreur vérification statut:', error);
        return null;
    }
}

// Exemple de fonction à ajouter à callback.html
function processCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || localStorage.getItem('paymentToken');
    
    if (token) {
        // Vérifier le statut
        checkPaymentStatus(token).then(data => {
            if (data?.status) {
                if (data.data.statut === 'paid') {
                    // Paiement réussi
                    alert('Paiement effectué avec succès !');
                    // Rediriger vers une page de confirmation
                    window.location.href = '/success.html';
                } else {
                    // Paiement échoué
                    alert('Paiement non effectué. Veuillez réessayer.');
                    window.location.href = '/';
                }
            }
        });
    }
}
