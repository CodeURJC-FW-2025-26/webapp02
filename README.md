# Secretos de Cocina

Una página web de recetas caseras.



## Equipo de desarrollo

| Nombre completo         | Correo oficial de la URJC                | GitHub      |
|-------------------------|------------------------------------------|-------------|
| Fernán Rama Hombreiro   | f.rama.2024@alumnos.urjc.es              | [fernanrama](https://github.com/fernanrama) |
| Izan Calle Feijoo       | i.calle.2024@alumnos.urjc.es             | [IzanCalle](https://github.com/IzanCalle)   |
| Rubén Torres Rivero     | r.torresr.2024@alumnos.urjc.es           | [Ruben2843](https://github.com/Ruben2843)   |



## Herramientas de coordinación

No utilizamos Trello. 
Si incorporamos alguna herramienta, pondremos el enlace aquí.



## Funcionalidad

### 🔹 Entidades

- Entidad principal: Receta 
  Atributos:  
  - id (identificador único, numérico)  
  - nombre (string)  
  - ingredientes (lista de strings)    
  - categoría (string: postre, entrante, plato principal, vegano, etc.)  
  - tiempo_preparacion (entero, en minutos)  
  - dificultad (string: fácil, media, difícil)  

- Entidad secundaria: Paso  
  Atributos:  
  - id (identificador único, numérico)  
  - receta_id (identificador de la receta a la que pertenece)  
  - orden (entero, indica el número de paso en la secuencia)  
  - descripcion (texto detallado del paso)  
  - imagen (opcional, muestra el resultado de ese paso intermedio)  



### Imágenes

- Cada receta podrá tener asociada una o varias imágenes que muestren el plato terminado.  
- Cada paso podrá incluir una imagen que muestre el estado intermedio de la preparación.  

### Categorización
Utilizaremos la consulta de categorización para las recetas. 
El usuario podrá consultar recetas según su categoría, por ejemplo: 

- Platos principales  
- Postres  
- Entrantes  
- Vegetarianos / Veganos
