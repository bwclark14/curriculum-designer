/* Demo data. A level spec is either an array/string of statements (own),
   '^' meaning "inherit the statements written above at this level", or
   '-' meaning "name only": the strand is there to group sub-strands, with no statement. */
(function () {
  let n = 0;
  const id = () => 'seed' + (++n);
  function S(name, spec, children = [], description = '') {
    const levels = {};
    for (const [k, v] of Object.entries(spec)) {
      levels[k] = v === '^' ? { mode: 'inherit', statements: [] }
        : v === '-' ? { mode: 'group', statements: [] }
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

      S('The connected world', { first: '-' }, [
        S('Nature and the Earth’s resources', { first: '-' }, [
          S('Nature', { first: 'Living things and their habitats are part of a natural world that we depend on.' }),
          S('Food', { first: 'Our food comes from plants and animals, and is grown, caught or farmed.' }),
          S('Materials', { first: 'Many everyday materials come from the Earth and from living things.' })
        ])
      ], 'A name-only strand: it groups sub-strands and has no statement of its own.'),

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

  const technologies = {
    id: 'area-technologies',
    name: 'Technologies',
    purpose: 'Technologies develop learners as confident, creative designers and makers who understand how technological systems shape their lives, and who use them responsibly.',
    bigIdeas: [
      { name: 'Systems thinking', description: 'Technological products are systems of connected parts with inputs, processes and outputs.' },
      { name: 'Design', description: 'Good design responds to real needs and improves through testing and feedback.' }
    ],
    strands: [
      S('Systems', {
        early: 'Everyday objects are made of parts that work together.',
        first: 'A system takes an input, does something with it and gives an output.',
        second: 'A system can be broken down into smaller parts, each with its own job.',
        third: 'Feedback lets a system check and adjust its own behaviour.',
        fourth: 'Complex systems are designed by managing how their sub-systems interact.'
      }, [
        S('Engineering', {
          first: '^',
          second: 'Mechanisms such as levers and gears change the size and direction of a force.',
          third: '^'
        }),
        S('Computing', {
          first: '^',
          second: '^',
          third: 'Algorithms can control a system and respond to its sensors.'
        })
      ], 'How technological systems are put together and controlled.'),
      S('Design and making', {
        early: 'We can plan and make things for a purpose.',
        first: 'Designs can be improved by testing them.',
        second: 'Designers choose materials and tools to suit a brief.',
        third: 'Designing for users means understanding their needs.',
        fourth: 'Sustainable design considers a product’s whole life cycle.'
      })
    ]
  };

  // Give demo understanding IDs, e.g. "SCN 2-03" (area prefix, level 0–4, running number),
  // only at the lowest level of understanding: a strand gets IDs at a level only when none of
  // its sub-strands are taught there. Sub-strands that inherit still get their own IDs.
  function assignIds(area, prefix) {
    const nums = ['early', 'first', 'second', 'third', 'fourth'];
    const count = {};
    const next = (lvl, d) => {
      count[lvl] = (count[lvl] || 0) + 1;
      return `${prefix} ${d}-${String(count[lvl]).padStart(2, '0')}`;
    };
    const walk = (list, parentShown) => list.forEach(s => {
      const shown = {};
      nums.forEach((lvl, d) => {
        const L = s.levels[lvl];
        if (!L) return;
        L.codes = [];
        if (L.mode === 'own') {
          L.statements = L.statements.map(text => ({ code: '', text }));
          shown[lvl] = L.statements;
        } else {
          // inherit, or name only (which passes the statements above it through to its sub-strands)
          shown[lvl] = parentShown[lvl] || [];
        }
        const lowest = !s.children.some(c => c.levels[lvl]);
        if (!lowest || L.mode === 'group') return;
        if (L.mode === 'own') L.statements.forEach(t => { t.code = next(lvl, d); });
        else L.codes = shown[lvl].map(() => next(lvl, d));
      });
      walk(s.children, shown);
    });
    walk(area.strands, {});
  }
  assignIds(sciences, 'SCN');
  assignIds(technologies, 'TCH');
  assignIds(arts, 'EXA');

  /* --- Example knows & dos --- */
  let k = 0;
  const item = (text, images = []) => ({ id: 'kdi' + (++k), text, images });
  const col = (name, sequenced, knows, dos) => ({ id: 'kdc' + (++k), name, sequenced, knows: knows.map(t => typeof t === 'string' ? item(t) : t), dos: dos.map(t => typeof t === 'string' ? item(t) : t) });
  /** Attach knows & dos to the `i`th understanding of the first strand called `name` at `lvl`. */
  function attach(area, name, lvl, i, kd) {
    const find = list => { for (const s of list) { if (s.name === name) return s; const f = find(s.children); if (f) return f; } return null; };
    const L = find(area.strands).levels[lvl];
    if (L.mode === 'own') L.statements[i].kd = kd;
    else { L.kd = L.kd || []; L.kd[i] = kd; }
  }

  // A simple labelled diagram, stored like an uploaded image (a data URL).
  const pressureDiagram = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 170" font-family="Helvetica,Arial,sans-serif">' +
    '<rect width="320" height="170" fill="#fff"/>' +
    '<rect x="40" y="70" width="80" height="60" fill="#c9d8f0" stroke="#1f1c24" stroke-width="2"/>' +
    '<rect x="190" y="100" width="100" height="30" fill="#c9d8f0" stroke="#1f1c24" stroke-width="2"/>' +
    '<line x1="10" y1="131" x2="310" y2="131" stroke="#1f1c24" stroke-width="3"/>' +
    '<line x1="80" y1="20" x2="80" y2="62" stroke="#b5442a" stroke-width="3"/><path d="M72 56 L80 68 L88 56Z" fill="#b5442a"/>' +
    '<line x1="240" y1="50" x2="240" y2="92" stroke="#b5442a" stroke-width="3"/><path d="M232 86 L240 98 L248 86Z" fill="#b5442a"/>' +
    '<text x="90" y="34" font-size="14" fill="#b5442a">F</text><text x="250" y="64" font-size="14" fill="#b5442a">F</text>' +
    '<text x="40" y="155" font-size="12" fill="#1f1c24">small area: high pressure</text>' +
    '<text x="180" y="155" font-size="12" fill="#1f1c24">large area: low pressure</text></svg>');

  attach(sciences, 'Forces', 'third', 0, {
    sequenced: true,
    collections: [
      col('Calculating pressure', true, [
        'Pressure is the force acting on each unit of area: $P = \\frac{F}{A}$',
        'Pressure is measured in pascals, where $1\\,\\text{Pa} = 1\\,\\text{N m}^{-2}$.',
        item('The same force spread over a larger area gives a smaller pressure.', [{ id: 'img1', src: pressureDiagram, alt: 'The same force on a small area and on a large area' }])
      ], [
        'Rearrange $P = \\frac{F}{A}$ to find force or area.',
        'Calculate the pressure under a block resting on each of its faces.'
      ]),
      col('Pressure in everyday life', false, [
        'Sharp blades and snowshoes work by changing the area a force acts on.'
      ], [
        'Explain, using the idea of pressure, why a knife cuts more easily when it is sharp.'
      ])
    ]
  });

  attach(technologies, 'Systems', 'early', 0, {
    sequenced: false,
    collections: [
      col('', false, [
        'Objects can be taken apart into smaller parts.',
        'Each part of an object has a job to do.'
      ], [
        'Take apart a simple toy and name some of its parts.',
        'Say what one part does and what would happen without it.'
      ])
    ]
  });

  attach(technologies, 'Engineering', 'first', 0, {
    sequenced: false,
    collections: [
      col('Inputs, processes and outputs', true, [
        'An input is what goes into a system.',
        'A process changes the input.',
        'An output is what the system produces.'
      ], [
        'Identify the input, process and output of a familiar machine, such as a toaster.'
      ])
    ]
  });

  /* --- Cross-cutting themes, shared by every curriculum area --- */
  const themes = [
    ['CCCAP', 'Career and Pathways'],
    ['CCC', 'Creativity'],
    ['CCDV', 'Democratic Values'],
    ['CCDS', 'Digital Skills'],
    ['CCE', 'Entrepreneurship'],
    ['CCLFS', 'Learning for Sustainability'],
    ['CCMAF', 'Money and Finance'],
    ['CCSJE', 'Social Justice and Equalities']
  ].map(([code, name]) => ({ id: 'theme-' + code.toLowerCase(), code, name }));

  /** Tag the `i`th understanding of the first strand called `name` at `lvl` with theme codes. */
  function tag(area, name, lvl, i, codes) {
    const find = list => { for (const s of list) { if (s.name === name) return s; const f = find(s.children); if (f) return f; } return null; };
    const L = find(area.strands).levels[lvl];
    const blank = () => ({ sequenced: false, collections: [], themes: [] });
    let kd;
    if (L.mode === 'own') kd = L.statements[i].kd = L.statements[i].kd || blank();
    else { L.kd = L.kd || []; kd = L.kd[i] = L.kd[i] || blank(); }
    kd.themes = codes.map(c => 'theme-' + c.toLowerCase());
  }
  tag(sciences, 'Nature', 'first', 0, ['CCLFS']);
  tag(sciences, 'Food', 'first', 0, ['CCLFS', 'CCSJE']);
  tag(sciences, 'Energy sources and sustainability', 'third', 0, ['CCLFS', 'CCMAF']);
  tag(sciences, 'Topical science', 'fourth', 0, ['CCDV', 'CCSJE']);
  tag(technologies, 'Computing', 'third', 0, ['CCDS', 'CCCAP']);
  tag(technologies, 'Engineering', 'first', 0, ['CCE', 'CCC']);
  tag(technologies, 'Design and making', 'fourth', 0, ['CCLFS', 'CCE']);
  tag(arts, 'Art and design', 'second', 0, ['CCC', 'CCE']);

  window.SEED = { currentId: sciences.id, areas: [sciences, technologies, arts], themes };
})();
