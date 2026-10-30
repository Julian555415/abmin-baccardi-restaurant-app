(function() {

/* ==========================================================================
   CONFIGURACIÓN DE SUPABASE
   ========================================================================== */
const SUPABASE_URL = 'https://todcmniumymwnloujcgb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q2mRmPcKxNj0ZKxGp15jYg_8NOcWvSo'; 
const MASTER_PASSWORD = "baccardi2026";
const MASTER_EMAIL = "admin@baccardi.com";

let supabase = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.error('La librería de Supabase no está disponible.');
  }
} catch (err) {
  console.error('Error al inicializar Supabase:', err);
}

/* ==========================================================================
   CONTROL DE ACCESO CON EL FORMULARIO VISUAL
   ========================================================================== */
function initAdminAuth() {
  const loginForm = document.getElementById('loginForm') || document.querySelector('form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const emailInput = document.getElementById('adminEmail') || document.querySelector('input[type="email"]');
      const passInput = document.getElementById('adminPassword') || document.querySelector('input[type="password"]');
      const errorMsg = document.getElementById('loginError') || document.querySelector('.error-msg, span[style*="color"]');

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passInput ? passInput.value.trim() : '';

      if (email === MASTER_EMAIL && password === MASTER_PASSWORD) {
        console.log('Acceso concedido.');
        mostrarPanelPrincipal();
      } else {
        console.log('Credenciales incorrectas.');
        if (errorMsg) {
          errorMsg.style.display = 'block';
          errorMsg.textContent = 'Correo o contraseña incorrectos.';
        } else {
          alert('Correo o contraseña incorrectos.');
        }
      }
    });
  }
}

function mostrarPanelPrincipal() {
  const bloqueo = document.getElementById('adminBloqueado') || document.querySelector('.login-container');
  const adminApp = document.getElementById('adminApp');

  if (bloqueo) bloqueo.style.display = 'none';
  if (adminApp) adminApp.style.display = 'block';

  cargarListaProductos();
  setupEventListenersAdmin();
}

document.addEventListener('DOMContentLoaded', initAdminAuth);

/* ==========================================================================
   CARGAR Y GESTIONAR PRODUCTOS
   ========================================================================== */
async function cargarListaProductos() {
  const container = document.getElementById('adminProductList');
  if (!container) return;

  if (!supabase) {
    container.innerHTML = `<p style="color: var(--text-muted);">No se pudo conectar con la base de datos.</p>`;
    return;
  }

  container.innerHTML = `<p style="color: var(--text-muted);">Cargando productos...</p>`;

  const { data, error } = await supabase.from('menu').select('*').order('categoria', { ascending: true });

  if (error) {
    console.error('Error al cargar productos:', error);
    container.innerHTML = `<p style="color: var(--text-muted);">Error al cargar los productos.</p>`;
    return;
  }

  const productos = data || [];

  if (productos.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted);">Todavía no hay productos en la carta.</p>`;
    return;
  }

  container.innerHTML = productos.map(prod => `
    <div class="admin-product-row">
      <img src="${prod.imagen}" alt="${prod.nombre}" class="admin-product-thumb" onerror="this.src='https://via.placeholder.com/60?text=%20'">
      <div class="admin-product-info">
        <strong>${prod.nombre}</strong>
        <span class="admin-product-cat">${prod.categoria}</span>
      </div>
      <span class="admin-product-price">$${Number(prod.precio).toLocaleString('es-CO')}</span>
      <button class="btn-delete-prod-admin" data-id="${prod.id}" title="Eliminar producto">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-delete-prod-admin').forEach(btn => {
    btn.addEventListener('click', () => eliminarProducto(Number(btn.dataset.id)));
  });
}

async function eliminarProducto(id) {
  if (!supabase) return;
  if (!confirm('¿Seguro que deseas eliminar este producto de la carta?')) return;

  const { error } = await supabase.from('menu').delete().eq('id', id);
  if (error) {
    alert('Hubo un error al eliminar el producto.');
    return;
  }
  await cargarListaProductos();
}

function setupEventListenersAdmin() {
  const addForm = document.getElementById('addProductForm');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('prodName').value;
      const categoria = document.getElementById('prodCategory').value;
      const descripcion = document.getElementById('prodDesc').value;
      const precio = parseFloat(document.getElementById('prodPrice').value);
      const imgSource = document.querySelector('input[name="imgSource"]:checked')?.value || 'url';

      let imagen = 'https://via.placeholder.com/300x200?text=Baccardi';
      if (imgSource === 'url') {
        imagen = document.getElementById('prodImgUrl').value || imagen;
        await guardarProductoSupabase(nombre, categoria, descripcion, precio, imagen);
      } else {
        const fileInput = document.getElementById('prodImgFile');
        if (fileInput && fileInput.files[0]) {
          try {
            imagen = await comprimirImagen(fileInput.files[0]);
            await guardarProductoSupabase(nombre, categoria, descripcion, precio, imagen);
          } catch (err) {
            alert('No se pudo procesar la imagen.');
          }
        } else {
          await guardarProductoSupabase(nombre, categoria, descripcion, precio, imagen);
        }
      }
    });
  }
}

function comprimirImagen(file, maxAncho = 800, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let ancho = img.width;
        let alto = img.height;
        if (ancho > maxAncho) {
          alto = Math.round((alto * maxAncho) / ancho);
          ancho = maxAncho;
        }
        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, ancho, alto);
        resolve(canvas.toDataURL('image/webp', calidad));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function guardarProductoSupabase(nombre, categoria, descripcion, precio, imagen) {
  const { error } = await supabase.from('menu').insert([{ nombre, categoria, descripcion, precio, imagen }]);
  if (error) {
    alert('Hubo un error al guardar el producto.');
    return;
  }
  await cargarListaProductos();
  document.getElementById('addProductForm').reset();
  alert('Producto agregado con éxito.');
}

})();
