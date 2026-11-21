export const responsibility = 'You can examine your own conduct where it applies. The person who caused abuse or mistreatment is responsible for that harm. You can leave this answer blank.'

export const sections = {
  resentments: {
    title: 'Resentments', pages: '2–4', reading: '64–67', singular: 'Resentment',
    description: 'Name what happened and what it affected. Return to My part when you’re ready.',
    fields: {
      who: ['Who or what?', 'A person, institution, or principle you resent.'],
      cause: ['The cause', 'What happened? Be specific about what caused the resentment.'],
      affected: ['What was affected?', 'Consider self-esteem, security, ambitions, personal relationships, sex relationships, and finances.'],
    },
    second: {
      part: ['My part', `${responsibility} Where relevant, consider selfishness, dishonesty, self-seeking, or fear.`],
    },
  },
  fears: {
    title: 'Fears', pages: '5–6', reading: '67–68', singular: 'Fear',
    description: 'Explore what you fear, how it affects you, and what you can consider instead.',
    fields: {
      fear: ['What am I afraid of?'],
      why: ['Why do I have this fear?'],
      effect: ['How has it affected my thinking or actions?'],
      alternatives: ['Where does self-reliance enter the picture? What can I consider instead?', 'Think about when you relied on yourself alone, where it fell short, and what alternative perspective or support might help.'],
    },
  },
  relationships: {
    title: 'Sex & Relationships', pages: '7–9', reading: '68–70', singular: 'Situation or relationship',
    description: 'Look at your conduct in one situation or significant relationship at a time.',
    fields: {
      person: ['Person or relationship'],
      situation: ['Relevant situation or conduct'],
      behavior: ['Where was I selfish, dishonest, or inconsiderate?'],
      harm: ['Whom did I hurt, and how?'],
      jealousy: ['Did I contribute to jealousy, suspicion, or bitterness without justification?'],
      fault: ['Where was I at fault?', 'You can look at your own conduct where this question applies. Responsibility for abuse, coercion, or mistreatment belongs to the person who caused it. You can leave this answer blank.'],
      instead: ['What should I have done instead?'],
      future: ['What would healthier, more considerate conduct look like going forward?'],
    },
  },
}

export const reviewPages = {
  review: { title: 'Review checklist', page: 10, description: 'Use this checklist to reflect on what you covered. Leave boxes unchecked as needed.' },
  reflection: { title: 'What have I learned?', page: 11, description: 'These writing prompts are optional.' },
  preparation: { title: 'Step Five preparation', page: 12, description: 'Plan how to share the exact nature of your wrongs with God, yourself, and another person. Big Book reference, pages 72–75.' },
}

export const checklist = {
  Resentments: {
    major: 'I listed the major people, institutions, and principles I resent.',
    causes: 'I identified specific causes.',
    areas: 'I considered the areas of my life affected.',
    conduct: 'I examined my own conduct where applicable.',
    responsibility: 'I distinguished my responsibility from harm done to me by others.',
  },
  Fears: {
    recurring: 'I identified recurring or significant fears.',
    considered: 'I considered why these fears exist.',
    shaped: 'I examined how fear has shaped my choices or behavior.',
    reliance: 'I considered the role of self-reliance.',
  },
  'Sex & Relationships': {
    relationships: 'I considered my conduct in significant relationships.',
    harmed: 'I identified situations where I harmed others.',
    behavior: 'I examined dishonesty, selfishness, or inconsideration.',
    different: 'I considered what I should have done differently.',
    healthier: 'I identified principles for healthier future behavior.',
  },
  'Overall review': {
    honest: 'I made a sincere effort to be honest and thorough.',
    readings: 'I reviewed the relevant Big Book instructions.',
    avoidance: 'I identified anything I may have deliberately avoided.',
    discuss: 'I am prepared to discuss this inventory with my sponsor or another appropriate person.',
  },
}

export const reflections = {
  patterns: ['What patterns have I noticed in my resentments?'],
  fears: ['Which fears appear repeatedly in my life?'],
  behavior: ['Where have selfishness, dishonesty, self-seeking, or fear influenced my behavior?'],
  change: ['What would I like to begin doing differently?'],
  avoided: ['Is there anything important I have avoided or need to discuss?'],
}

export const prepChecklist = {
  'Before Step Five': {
    complete: 'My inventory is complete to the best of my current ability.',
    arranged: 'I have arranged a private, appropriate time and place for Step Five.',
    questionsAllowed: 'I understand that I can ask questions before beginning.',
    unaddressed: 'I have considered whether anything important remains unaddressed.',
  },
}

export const prepFields = {
  person: ['Person I plan to share with'],
  time: ['Date / time'],
  questions: ['Questions I want to discuss beforehand'],
}
