# 🍴 Secretos de Cocina

Un catálogo web de recetas pensado para inspirar, organizar y compartir platos de todo tipo.  
Este repositorio contiene el código fuente y la documentación del proyecto.

---

## 👥 Equipo de desarrollo

| Nombre completo         | Correo oficial de la URJC                | GitHub      |
|-------------------------|------------------------------------------|-------------|
| Fernán Rama Hombreiro   | f.rama.2024@alumnos.urjc.es              | [fernanrama](https://github.com/fernanrama) |
| Izan Calle Feijoo       | i.calle.2024@alumnos.urjc.es             | [IzanCalle](https://github.com/IzanCalle)   |
| Rubén Torres Rivero     | r.torresr.2024@alumnos.urjc.es           | [Ruben2843](https://github.com/Ruben2843)   |

---

## 📌 Herramientas de coordinación

Actualmente no utilizamos Trello ni otras herramientas de coordinación públicas.  
En caso de incorporarlas, el enlace aparecerá aquí.

---

## ⚙️ Funcionalidad

### 🔹 Entidades

- *Entidad principal: Receta*  
  Atributos:  
  - id (identificador único, numérico)  
  - nombre (string)  
  - ingredientes (lista de strings)  
  - instrucciones (texto detallado)  
  - categoría (string: postre, entrante, plato principal, vegano, etc.)  
  - tiempo_preparacion (entero, en minutos)  
  - dificultad (string: fácil, media, difícil)  

- *Entidad secundaria: Usuario*  
  Atributos:  
  - id (identificador único, numérico)  
  - nombre (string)  
  - correo (string)  
  - rol (string: administrador, visitante)  

---

### 🖼️ Imágenes

- Cada *receta* podrá tener asociada *una o varias imágenes* que muestren el plato terminado o pasos intermedios.  
- Los *usuarios* tendrán opcionalmente una imagen de perfil.  

Ejemplo de almacenamiento de rutas de imágenes en código:

```json
{
  "id": 12,
  "nombre": "Paella Valenciana",
  "imagenes": [
    "/img/paella1.jpg",
    "/img/paella2.jpg"
  ]
}
