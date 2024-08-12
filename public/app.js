// Configuración de Firebase
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const newPostBtn = document.getElementById('newPostBtn');
const postForm = document.getElementById('postForm');
const newPostForm = document.getElementById('newPostForm');
const postsContainer = document.getElementById('posts');
const paginationContainer = document.getElementById('pagination');
const categoryFilter = document.getElementById('categoryFilter');

let currentUser = null;
let currentPage = 1;
let postsPerPage = 5;
let currentCategory = '';

// Autenticación
loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        newPostBtn.style.display = 'inline-block';
    } else {
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        newPostBtn.style.display = 'none';
        postForm.style.display = 'none';
    }
    loadPosts();
});

// TinyMCE
tinymce.init({
    selector: '#postContent',
    plugins: 'advlist autolink lists link image charmap print preview hr anchor pagebreak',
    toolbar_mode: 'floating',
    height: 300
});

// Nuevo post
newPostBtn.addEventListener('click', () => {
    postForm.style.display = 'block';
});

newPostForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('postTitle').value;
    const category = document.getElementById('postCategory').value;
    const content = tinymce.get('postContent').getContent();

    const postData = {
        title: title,
        category: category,
        content: content,
        author: currentUser.displayName,
        authorId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    database.ref('posts').push(postData).then(() => {
        newPostForm.reset();
        tinymce.get('postContent').setContent('');
        postForm.style.display = 'none';
        loadPosts();
    });
});

document.getElementById('cancelPost').addEventListener('click', () => {
    newPostForm.reset();
    tinymce.get('postContent').setContent('');
    postForm.style.display = 'none';
});

// Cargar posts
function loadPosts() {
    const postsRef = database.ref('posts');
    postsRef.once('value', (snapshot) => {
        const allPosts = [];
        snapshot.forEach((childSnapshot) => {
            const post = childSnapshot.val();
            post.id = childSnapshot.key;
            allPosts.push(post);
        });

        const filteredPosts = currentCategory ? 
            allPosts.filter(post => post.category === currentCategory) : 
            allPosts;

        const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
        const startIndex = (currentPage - 1) * postsPerPage;
        const endIndex = startIndex + postsPerPage;
        const postsToShow = filteredPosts.slice(startIndex, endIndex);

        displayPosts(postsToShow);
        displayPagination(totalPages);
        updateCategoryFilter(allPosts);
    });
}

function displayPosts(posts) {
    postsContainer.innerHTML = '';
    posts.forEach((post) => {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        postElement.innerHTML = `
            <h2>${post.title}</h2>
            <p>Categoría: ${post.category}</p>
            <p>Autor: ${post.author}</p>
            <button class="toggle-content">Ver contenido</button>
            <div class="edit-buttons">
                <button class="edit-post boton-como-enlace">Editar</button>
                <button class="delete-post boton-como-enlace">Eliminar</button>
            </div>
        `;

        const toggleButton = postElement.querySelector('.toggle-content');
        const overlay = document.getElementById('postOverlay');
        const overlayContent = document.getElementById('overlayContent');
        const closeOverlayBtn = document.getElementById('closeOverlay');
        const deleteButton = postElement.querySelector('.delete-post');
        const editButton = postElement.querySelector('.edit-post');

        toggleButton.addEventListener('click', () => {
            overlayContent.innerHTML = `
                <h2>${post.title}</h2>
                <p>Categoría: ${post.category}</p>
                <p>Autor: ${post.author}</p>
                <div>${post.content}</div>
            `;
            overlay.style.display = 'block';
        });

        closeOverlayBtn.addEventListener('click', () => {
            overlay.style.display = 'none';
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });

        deleteButton.addEventListener('click', () => {
            if (confirm(`¿Estás seguro de que deseas eliminar el post "${post.title}"?`)) {
                database.ref('posts').child(post.id).remove().then(() => {
                    alert('Post eliminado exitosamente');
                    loadPosts();
                }).catch((error) => {
                    alert('Error al eliminar el post: ' + error.message);
                });
            }
        });

        editButton.addEventListener('click', () => {
            editPost(post);
        });

        if (currentUser && (currentUser.uid === post.authorId || currentUser.uid === 'ID_DEL_ADMIN')) {
            postElement.querySelector('.edit-buttons').style.display = 'block';
        }

        postsContainer.appendChild(postElement);
    });
}

function editPost(post) {
    const postForm = document.getElementById('postForm');
    const postTitleInput = document.getElementById('postTitle');
    const postCategorySelect = document.getElementById('postCategory');
    const postContentEditor = tinymce.get('postContent');

    postTitleInput.value = post.title;
    postCategorySelect.value = post.category;
    postContentEditor.setContent(post.content);

    postForm.style.display = 'block';

    const newPostForm = document.getElementById('newPostForm');
    newPostForm.removeEventListener('submit', createNewPost);
    newPostForm.addEventListener('submit', function updatePost(e) {
        e.preventDefault();

        const updatedTitle = postTitleInput.value;
        const updatedCategory = postCategorySelect.value;
        const updatedContent = postContentEditor.getContent();

        database.ref('posts').child(post.id).update({
            title: updatedTitle,
            category: updatedCategory,
            content: updatedContent
        }).then(() => {
            alert('Post actualizado exitosamente');
            postForm.style.display = 'none';
            newPostForm.reset();
            tinymce.get('postContent').setContent('');
            loadPosts();
        }).catch((error) => {
            alert('Error al actualizar el post: ' + error.message);
        });

        newPostForm.removeEventListener('submit', updatePost);
        newPostForm.addEventListener('submit', createNewPost);
    });
}

function createNewPost(e) {
    e.preventDefault();
    const title = document.getElementById('postTitle').value;
    const category = document.getElementById('postCategory').value;
    const content = tinymce.get('postContent').getContent();

    const postData = {
        title: title,
        category: category,
        content: content,
        author: currentUser.displayName,
        authorId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    database.ref('posts').push(postData).then(() => {
        newPostForm.reset();
        tinymce.get('postContent').setContent('');
        postForm.style.display = 'none';
        loadPosts();
    });
}

document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('postOverlay');
    if (e.key === "Escape" && overlay.style.display === 'block') {
        overlay.style.display = 'none';
    }
});


// Cerrar el overlay con la tecla Esc
document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('postOverlay');
    if (e.key === "Escape" && overlay.style.display === 'block') {
        overlay.style.display = 'none';
    }
});



function displayPagination(totalPages) {
    paginationContainer.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.addEventListener('click', () => {
            currentPage = i;
            loadPosts();
        });
        paginationContainer.appendChild(button);
    }
}

function updateCategoryFilter(posts) {
    const categories = [...new Set(posts.map(post => post.category))];
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

categoryFilter.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    currentPage = 1;
    loadPosts();
});

// Carga inicial de posts
loadPosts();
