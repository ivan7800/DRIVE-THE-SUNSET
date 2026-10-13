/** Original roadside encounters. Choices are optional and never block a road. */
export const CHAPTERS={
 coast:[['Salmar · las últimas persianas','Pueblo costero',50],['Cornisa del faro','Carretera de acantilados',80],['Las Gaviotas','Túneles y roca',60],['El camino de las cartas','Calas y horizonte abierto',90]],
 mountain:[['El puente del viento','Llegada al valle',70],['Bosque de la niebla','Pinos y curvas',60],['La garganta','Paso de montaña',50],['El agua quieta','Descenso hacia el lago',80]],
 vineyards:[['La mesa de la masía','Olivos y muros de piedra',70],['Solana','Una estación en el camino',50],['Alba','Calle mayor y viñas',50],['El molino del regreso','Campos abiertos',90]],
 carmelo:[['Los Tilos','Plaza y tiendas de barrio',40],['La subida del mirador','Terrazas sobre Barcelona',50],['La Loma','Viaducto y talleres',60],['Miralba','La calle del cine',40]]
};
export const ENCOUNTERS={
 coast:[
  {id:'coast-letter',at:620,title:'La carta azul',text:'La mujer del quiosco sostiene un sobre. «Si bajas a la cala, ¿se lo dejas a mi hermano? Lleva un mes diciendo que viene a cenar». La dirección está escrita sobre una mancha de café.',options:[['Llevar la carta','promise','Dejas el sobre en la guantera. La cala está al final de esta carretera.'],['Quedarte a escuchar','listen','Te cuenta cómo aprendieron a nadar allí. Al despedirse, te regala una moneda para la cabina.']]},
  {id:'coast-call',at:7180,title:'Una llamada junto al mar',text:'La cabina tiene la puerta abierta. Junto al embarcadero, un hombre recoge sus redes y levanta la mano para saludarte.',options:[['Acercarte al embarcadero','share','El hombre reconoce el nombre del quiosco. Deja las redes y busca dos sillas.'],['Llamar a casa','home','Al otro lado tardan en contestar. «Sí, soy yo. Estoy bien. Tardaré un poco».']]}
 ],
 mountain:[
  {id:'mountain-map',at:640,title:'El mapa doblado',text:'Un ciclista estudia un mapa sobre el pretil. Tiene una rueda desinflada. «El lago tiene dos entradas. Si vas por la vieja, avisa a la mujer de la caseta de que llegaré tarde».',options:[['Llevar el aviso','promise','Dobla el mapa para enseñarte la caseta, al final del descenso.'],['Compartir un descanso','listen','Te sientas en el pretil. Durante un rato solo se oyen los pájaros y una bomba de aire.']]},
  {id:'mountain-chair',at:6850,title:'La segunda silla',text:'La mujer de la caseta acaba de poner agua a hervir. Hay dos sillas junto a la orilla. «La de la izquierda cojea», dice antes de que te sientes.',options:[['Esperar al ciclista','share','Acercas otra silla. Las luces de una bicicleta aparecen entre los árboles.'],['Dejar una nota y seguir','home','Escribes que el camino estaba abierto. El papel queda sujeto bajo una taza.']]}
 ],
 vineyards:[
  {id:'vineyards-bread',at:570,title:'Pan para Alba',text:'En la masía han hecho demasiadas hogazas. Una niña trae una bolsa hasta la ventanilla. «Mi abuelo está en el molino. Dice que el pan de ayer le gusta más, pero no es verdad».',options:[['Llevar la bolsa','promise','El asiento de al lado huele a pan caliente. El molino queda después de Alba.'],['Pedir la receta','listen','La madre sale a dictártela. La niña insiste en que apuntes también su nombre.']]},
  {id:'vineyards-table',at:8170,title:'La mesa del molino',text:'El hombre del molino barre la entrada. Al verte, apoya la escoba en la pared. «Queda queso. Y queda luz».',options:[['Sentarte a su mesa','share','Parte el pan con las manos. Cuando vuelves al coche, la bolsa está llena de aceitunas.'],['Guardar algo para el regreso','home','Te envuelve un trozo de queso. Dice que no lo dejes al sol.']]}
 ],
 carmelo:[
  {id:'carmelo-ticket',at:460,title:'Dos entradas',text:'Un vecino sale del bar con dos entradas dobladas. «Mi hermana trabaja en el Miralba. Hoy pasan la película que nos llevaba a ver mi padre». Mira el reloj y te ofrece una.',options:[['Aceptar la entrada','promise','La guardas detrás del parasol. La sesión empieza cuando se enciende el rótulo.'],['Preguntar por aquella tarde','listen','Te habla del autobús, de una bolsa de pipas y de su padre durmiéndose en la última fila.']]},
  {id:'carmelo-cinema',at:5450,title:'Antes de los títulos',text:'La taquillera abre una de las puertas. Desde dentro llegan voces y el ruido del proyector. En la acera aún queda un poco de calor.',options:[['Entrar en la sala','share','Alguien aparta una chaqueta del asiento de al lado. Llegas justo a tiempo.'],['Quedarte en la puerta','home','Ves la primera escena desde la calle. Después bajas la cuesta con las ventanillas abiertas.']]}
 ]
};
export const ENDINGS={
 coast:{quiet:['El mar al final','Llegas a la cala con el asiento de al lado vacío. Apagas el motor y bajas hasta el agua.'],promise:['Una silla en el embarcadero','La carta ya está en otras manos. Esta noche habrá un plato más en Salmar.'],together:['Voces sobre el agua','La cena puede esperar un poco. Te llevas del embarcadero una historia que no conocías.'],home:['Una voz conocida','La llamada ha sido corta. El camino de vuelta pesa un poco menos.']},
 mountain:{quiet:['La orilla en silencio','Las montañas pierden el color mientras caminas hasta la orilla.'],promise:['Tres tazas','El aviso llegó antes que la bicicleta. Al final hubo tiempo para todos.'],together:['Hasta que enfría el té','El ciclista te enseña la rueda reparada. Nadie tiene prisa por recoger las sillas.'],home:['Una nota bajo la taza','Dejas el lago detrás. En la caseta alguien encontrará tu letra al recoger la mesa.']},
 vineyards:{quiet:['La flecha en la tapia','Desde la última curva ves el molino entero. Mañana quizá vuelvas por el mismo camino.'],promise:['Pan de esta mañana','El abuelo guarda la bolsa de su nieta antes de servir el queso. Promete bajar a verla.'],together:['Aceitunas para el camino','El molino queda atrás. Llevas una bolsa nueva en el asiento de al lado.'],home:['La vuelta por Alba','El queso va envuelto en papel. Cruzas Alba cuando ya están recogiendo las terrazas.']},
 carmelo:{quiet:['Las ventanas de Miralba','Aparcas al final de la cuesta. Se oye una película desde la acera.'],promise:['La butaca reservada','La entrada doblada encuentra su sitio. Por una tarde, conoces el barrio desde dentro.'],together:['La última fila','La pantalla ilumina las caras. Cuando acaba la sesión, reconoces algunas en la calle.'],home:['Ventanillas abiertas','La música del cine se pierde al doblar la esquina. Barcelona sigue encendida abajo.']}
};
const choices=new Map(Object.values(ENCOUNTERS).flat().map(e=>[e.id,e.options.map(o=>o[1])]));
export function validJourney(raw){
 if(raw===undefined)return {};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>8)return null;
 const result={};for(const [id,value] of Object.entries(raw)){if(!choices.get(id)?.includes(value))return null;result[id]=value;}return result;
}
export function encounterNear(route,distance,journey={}){return ENCOUNTERS[route]?.find(e=>Math.abs(e.at-distance)<=125&&!journey[e.id])||null;}
/** Tease an unanswered roadside scene early enough to slow down before reaching it. */
export function encounterApproach(route,distance,journey={}){return ENCOUNTERS[route]?.find(e=>e.at-distance<=450&&e.at-distance>=-180&&!journey[e.id])||null;}
export function chooseEncounter(journey,id,index){const event=Object.values(ENCOUNTERS).flat().find(e=>e.id===id);if(!event||!Number.isInteger(index)||!event.options[index]||journey[id])return journey;return {...journey,[id]:event.options[index][1]};}
export function endingFor(route,journey={}){const events=ENCOUNTERS[route];const first=journey[events[0].id],last=journey[events[1].id];const kind=last==='home'?'home':last==='share'?(first==='promise'?'promise':'together'):'quiet';const [title,text]=ENDINGS[route][kind];return {id:route+':'+kind,title,text};}
export function validEnding(id){const [route,kind,...extra]=String(id).split(':');return !extra.length&&Object.hasOwn(ENDINGS,route)&&Object.hasOwn(ENDINGS[route],kind);}
