(function() {

/* ==========================================================================
   CONFIGURACIÓN DE SUPABASE
   ========================================================================== */
const SUPABASE_URL = 'https://todcmniumymwnloujcgb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q2mRmPcKxNj0ZKxGp15jYg_8NOcWvSo'; // Su Publishable key de Supabase
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
   CANDADO DE ACCESO (FORMULARIO VISUAL DE LOGIN)
   ========================================================================== */
function verificarAcceso() {
  const loginForm = document.getElementById('loginForm') || document.querySelector('.login-container form') || document.querySelector('form');
  
  if (!loginForm) {
    console.error('No se encontró el formulario de inicio de sesión.');
    return;
  }

  // Evitar auto-envíos o comportamientos extraños del navegador
  loginForm.setAttribute('autocomplete', 'off');

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const emailInput = document.getElementById('adminEmail') || loginForm.querySelector('input[type="email"]');
    const passInput = document.getElementById('adminPassword') || loginForm.querySelector('input[type="password"]');
    const errorMsg = document.getElementById('loginError') || loginForm.querySelector('.error-msg');

    const email = emailInput ? emailInput.value.trim() : '';
    const clave = passInput ? passInput.value.trim() : '';

    console.log('Intento de acceso con correo:', email);

    if (email === MASTER_EMAIL && clave === MASTER_PASSWORD) {
      console.log('Clave correcta, mostrando el panel.');
      document.getElementById('adminApp').style.display = 'block';
      const bloqueo = document.getElementById('adminBloqueado') || document.querySelector('.login-container');
      if (bloqueo) bloqueo.style.display = 'none';
      iniciarPanelAdmin();
    } else {
      console.log('Clave incorrecta o cancelada.');
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Correo o contraseña incorrectos.';
      } else {
        alert('Correo o contraseña incorrectos.');
      }
    }
  });
}

function mostrarPantallaBloqueada() {
  const adminApp = document.getElementById('adminApp');
  if (adminApp) adminApp.style.display = 'none';
  const bloqueo = document.getElementById('adminBloqueado') || document.querySelector('.login-container');
  if (bloqueo) bloqueo.style.display = 'flex';
}

/* ==========================================================================
   INICIALIZACIÓN DEL PANEL (solo corre si la clave fue correcta)
   ========================================================================== */
function iniciarPanelAdmin() {
  cargarListaProductos();
  setupEventListenersAdmin();
}

document.addEventListener('DOMContentLoaded', verificarAcceso);

/* ==========================================================================
   CARGAR Y MOSTRAR LA LISTA DE PRODUCTOS ACTUALES (CON BOTÓN ELIMINAR)
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
  if (!supabase) {
    alert('No hay conexión con la base de datos.');
    return;
  }
  if (!confirm('¿Seguro que deseas eliminar este producto de la carta?')) return;

  const { error } = await supabase.from('menu').delete().eq('id', id);

  if (error) {
    console.error('Error al eliminar en Supabase:', error);
    alert('Hubo un error al eliminar el producto.');
    return;
  }

  await cargarListaProductos();
}

/* ==========================================================================
   FORMULARIO: AGREGAR PRODUCTO NUEVO (CON COMPRESIÓN DE IMAGEN)
   ========================================================================== */
function setupEventListenersAdmin() {
  const addForm = document.getElementById('addProductForm');
  if (!addForm) return;

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('prodName').value;
    const categoria = document.getElementById('prodCategory').value;
    const descripcion = document.getElementById('prodDesc').value;
    const precio = parseFloat(document.getElementById('prodPrice').value);

    const imgSourceRadio = document.querySelector('input[name="imgSource"]:checked');
    const imgSource = imgSourceRadio ? imgSourceRadio.value : 'url';

    if (imgSource === 'url') {
      const imagen = document.getElementById('prodImgUrl').value || 'https://via.placeholder.com/300x200?text=Baccardi';
      guardarProductoSupabase(nombre, categoria, descripcion, precio, imagen);
    } else {
      const fileInput = document.getElementById('prodImgFile');
      if (fileInput.files && fileInput.files[0]) {
        const submitBtn = document.querySelector('#addProductForm .btn-submit');
        const textoOriginal = submitBtn ? submitBtn.textContent : null;
        try {
          if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Optimizando imagen...'; }
          const imagenComprimida = await comprimirImagen(fileInput.files[0]);
          await guardarProductoSupabase(nombre, categoria, descripcion, precio, imagenComprimida);
        } catch (err) {
          console.error('Error al comprimir la imagen:', err);
          alert('No se pudo procesar la imagen. Intenta con otra foto.');
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = textoOriginal; }
        }
      } else {
        guardarProductoSupabase(nombre, categoria, descripcion, precio, 'https://via.placeholder.com/300x200?text=Baccardi');
      }
    }
  });

  // Cambio de fuente de imagen (URL o Archivo local)
  document.querySelectorAll('input[name="imgSource"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const prodImgUrl = document.getElementById('prodImgUrl');
      const prodImgFile = document.getElementById('prodImgFile');
      if (e.target.value === 'url') {
        if (prodImgUrl) prodImgUrl.style.display = 'block';
        if (prodImgFile) prodImgFile.style.display = 'none';
      } else {
        if (prodImgUrl) prodImgUrl.style.display = 'none';
        if (prodImgFile) prodImgFile.style.display = 'block';
      }
    });
  });
}

/**
 * Redimensiona y comprime una imagen en el navegador antes de guardarla,
 * para que una foto de celular quede en un archivo liviano formato WebP/JPEG.
 */
function comprimirImagen(file, maxAncho = 800, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
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

        let dataUrl = canvas.toDataURL('image/webp', calidad);
        if (!dataUrl || dataUrl.indexOf('data:image/webp') !== 0) {
          dataUrl = canvas.toDataURL('image/jpeg', calidad);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function guardarProductoSupabase(nombre, categoria, descripcion, precio, imagen) {
  if (!supabase) {
    alert('No hay conexión con la base de datos. Recarga la página e intenta de nuevo.');
    return;
  }
  const { error } = await supabase
    .from('menu')
    .insert([{ nombre, categoria, descripcion, precio, imagen }]);

  if (error) {
    console.error('Error al guardar en Supabase:', error);
    alert('Hubo un error al guardar el producto en la base de datos.');
    return;
  }

  await cargarListaProductos();
  const form = document.getElementById('addProductForm');
  if (form) form.reset();
  alert('Producto agregado con éxito a la carta.');
}

})();
