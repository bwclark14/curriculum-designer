/* Demo data. A level spec is either an array/string of statements (own)
   or '^' meaning "inherit the parent strand's statements at this level". */
(function () {
  let n = 0;
  const id = () => 'seed' + (++n);
  function S(name, spec, children = [], description = '') {
    const levels = {};
    for (const [k, v] of Object.entries(spec)) {
      levels[k] = v === '^'
        ? { mode: 'inherit', statements: [] }
        : { mode: 'own', statements: [].concat(v) };
    }
    return { id: id(), name, description, levels, children };
  }

  const sciences = {
    id: 'area-sciences',
    name: 'Sciences',
    purpose: 'Sciences help learners make sense of the natural and material world, develop the curiosity and skills to investigate it, and make informed, responsible decisions about their health, their communities and the planet.',
    bigIdeas: [
      { name: 'Interdependence', description: 'Living things depend on each other and on their environment.' },
      { name: 'Energy', description: 'Energy can be transferred and transformed, but never created or destroyed.' },
      { name: 'Particles and matter', description: 'Matter is made of particles whose arrangement explains its properties.' },
      { name: 'Evidence', description: 'Scientific ideas are built from evidence and can change when new evidence emerges.' }
    ],
    strands: [
      S('Planet Earth', {
        early: 'The natural world around us is full of living things we can explore with our senses.',
        first: ['Plants and animals live in habitats that provide what they need.', 'Seasons and weather change the world around us in patterns we can observe.'],
        second: 'Earth’s living and non-living systems are connected, and human activity affects them.',
        third: 'The balance of ecosystems depends on cycles of matter and flows of energy.',
        fourth: 'Sustaining life on Earth means understanding and managing the impact of human choices at a global scale.'
      }, [
        S('Biodiversity and interdependence', {
          early: '^',
          first: 'Living things can be sorted into groups by their features.',
          second: ['Organisms depend on each other for food, shelter and pollination.', 'Variation within a species helps it survive change.'],
          third: '^',
          fourth: 'Loss of biodiversity weakens an ecosystem’s resilience to change.'
        }, [
          S('Food chains and webs', {
            first: '^',
            second: 'Energy passes along food chains from producers to consumers.',
            third: '^'
          })
        ]),
        S('Energy sources and sustainability', {
          first: 'We use energy from different sources every day.',
          second: '^',
          third: 'Renewable and non-renewable sources differ in their long-term impact.',
          fourth: '^'
        }),
        S('Space', {
          second: 'Earth’s rotation and orbit explain day, night and the year.',
          third: 'Gravity shapes the movement of planets, moons and stars.'
        })
      ], 'How the living and non-living parts of our planet work and connect.'),

      S('Forces, electricity and waves', {
        early: 'Things move when they are pushed or pulled.',
        first: 'Forces can change the speed, direction or shape of an object.',
        second: 'Unbalanced forces change motion; friction and air resistance oppose movement.',
        third: 'Forces can be measured, and their effects predicted using simple relationships.',
        fourth: 'Work, energy and power describe how forces transfer energy within systems.'
      }, [
        S('Forces', {
          early: '^',
          first: '^',
          second: 'Gravity pulls objects towards the centre of the Earth.',
          third: 'Pressure depends on the size of a force and the area it acts over.',
          fourth: '^'
        }),
        S('Electricity', {
          first: 'Electricity only flows around a complete circuit.',
          second: 'Changing the components in a circuit changes how it behaves.',
          third: 'Current, voltage and resistance are related to each other.',
          fourth: 'Electrical energy can be generated, transmitted and used efficiently.'
        }, [
          S('Circuits', {
            second: '^',
            third: 'Series and parallel circuits share current in different ways.'
          })
        ]),
        S('Vibrations and waves', {
          early: 'Sounds are made when things vibrate.',
          first: 'Sound travels through materials and its pitch and volume can be changed.',
          third: 'Waves transfer energy without transferring matter.',
          fourth: 'Light and sound can be reflected, refracted and absorbed.'
        })
      ]),

      S('Biological systems', {
        first: 'Our bodies have parts that work together to keep us alive.',
        second: 'Body systems work together, and lifestyle choices affect them.',
        third: 'Cells are the building blocks of all living things.',
        fourth: 'Cells specialise, and genetic information controls how they work.'
      }, [
        S('Body systems and cells', {
          early: '^',
          first: '^',
          second: 'The heart, lungs and blood carry oxygen around the body.',
          third: '^'
        }),
        S('Inheritance', {
          second: 'Offspring inherit characteristics from their parents.',
          third: 'Characteristics are passed on through genes carried on chromosomes.',
          fourth: '^'
        })
      ]),

      S('Materials', {
        early: 'Materials can be described by how they look and feel.',
        first: 'Materials are chosen for a purpose because of their properties.',
        second: 'Some changes to materials can be reversed and others cannot.',
        third: 'The particle model explains states of matter and how they change.',
        fourth: 'Chemical reactions rearrange atoms to form new substances.'
      }, [
        S('Properties and uses', {
          early: '^',
          first: ['Materials can be grouped as solids, liquids or gases.', 'Some materials dissolve in water and some do not.'],
          second: '^'
        }),
        S('Chemical changes', {
          second: 'Burning and rusting make new materials.',
          third: 'Acids and alkalis can be identified and neutralised.',
          fourth: '^'
        })
      ]),

      S('Topical science', {
        second: 'Science appears in the news and in everyday decisions.',
        third: 'Scientific claims should be evaluated against evidence.',
        fourth: 'Scientific developments raise ethical questions for society.'
      })
    ]
  };

  const arts = {
    id: 'area-arts',
    name: 'Expressive arts',
    purpose: 'The expressive arts give learners ways to create, present and respond — building confidence, imagination and an appreciation of culture.',
    bigIdeas: [
      { name: 'Creative risk', description: 'Creativity grows through exploring, experimenting and taking risks.' },
      { name: 'Expression', description: 'The arts communicate ideas and feelings in ways that words alone cannot.' }
    ],
    strands: [
      S('Art and design', {
        early: 'We can make marks, shapes and images to show what we see and imagine.',
        first: 'Artists choose colour, line and texture on purpose.',
        second: 'Design solves problems for real people and audiences.',
        third: 'Art reflects and challenges the culture it comes from.',
        fourth: 'A personal style develops through sustained investigation.'
      }),
      S('Music', {
        early: 'Music is made from sounds we can control.',
        first: 'Music has a beat, and patterns that repeat.',
        second: 'Musical elements combine to create mood and meaning.',
        third: 'Music is shaped by its time, place and purpose.',
        fourth: 'Performers interpret music to communicate with an audience.'
      }, [
        S('Performing', { early: '^', first: '^', second: '^', third: 'Rehearsal improves accuracy and expression.', fourth: '^' }),
        S('Creating and composing', { first: 'We can invent simple musical patterns.', second: '^', third: 'Composers develop ideas through structure and variation.', fourth: '^' })
      ])
    ]
  };

  window.SEED = { currentId: sciences.id, areas: [sciences, arts] };
})();
