'use strict';
/* First-run data taken from Zaheer's CV and portfolio. Everything here can be edited inside the app. */
window.SEED = {
  profile: {
    name: 'Zaheer Abbas',
    headline: 'Electrical Engineer (Electronics) | PLC, HMI and Power Systems',
    about: 'Electrical Engineering graduate from FAST NUCES with hands-on experience in PLC programming (Allen-Bradley and Siemens), HMI and vision systems, and power factor correction. I recently completed an internship at Pakistan Aluminium Beverage Cans, where I worked on Rockwell Automation platforms and process control. I have a solid foundation in embedded systems and power system protection, with a focus on reliable control logic and safe working practices. I am seeking an entry-level role in power systems and automation.',
    location: 'Sadiqabad, Punjab, Pakistan',
    email: 'zaheer3504@gmail.com',
    phone: '+92 301 7647935',
    whatsapp: '923017647935',
    linkedin: 'https://linkedin.com/in/zaheer-abbas-04150b307',
    photoFile: 'assets/photo.jpg',
    statsText: '3.26/4.0 | CGPA\n3 | Internships and TA roles\n500 kV | Grid station studied\n8+ | Projects built',
    skillsText: 'Industrial Automation: PLC programming (Allen-Bradley, Siemens, Ladder Logic), HMI design (FactoryTalk View, Siemens KTP700), PowerFlex VFDs (525, 753), Pressco vision inspection, Sensor calibration\nPower Systems: Power factor and reactive power, Power system protection, CT/PT testing, Transformer testing, SF6 circuit breakers, Earthing, UPS systems, Switchgear\nEmbedded Platforms: Arduino Uno, ESP32, Raspberry Pi 4B, Sensor interfacing, Data acquisition, Wi-Fi communication\nProgramming: C, C++, Python, Assembly\nSoftware: MATLAB, Simulink, Proteus, TIA Portal, Studio 5000, TRiLOGI, KiCad, Arduino IDE\nIndustrial Knowledge: DCS and SCADA, P&ID reading, Technical documentation',
    expText: 'Industrial Automation Intern | Pakistan Aluminium Beverage Cans, Faisalabad | Aug 2026 - Sep 2026\nProgrammed Allen-Bradley ControlLogix 1756 and CompactLogix 1769 PLCs in Studio 5000 and built FactoryTalk View HMI screens for line control.\nLearned and helped support the Pressco vision inspection system that detects defective cans.\nTuned drive parameters on PowerFlex 525 and 753 VFDs for motor speed control.\nContributed to a power factor project, keeping reactive power balanced when plant load is low and solar output is high.\nDeveloped the training course on Allen-Bradley PLC (1769, 1756) and VFD (525, 753).\n\nEngineering Intern | WAPDA Engineering Academy, Faisalabad | Jun 2025 - Aug 2025\nStudied the layout, power flow, switching operations, and energization procedures of a 500 kV grid station.\nLearned the basics of energy meters, CTs, PTs, bus bar load shifting, circuit breakers, isolators, protection relays, transformers, and motors.\nFollowed Permit to Work, earthing, and safety procedures during maintenance. Awarded an Industrial Training Certificate (2025).\n\nTeaching Assistant | Feedback Control Systems and Electrical Network Analysis, FAST NUCES, Faisalabad | Aug 2024 - Jun 2026\nGraded assignments and quizzes and maintained course records and grade sheets.\nHelped students with control systems and circuit analysis during labs and office hours.',
    eduText: 'Bachelor of Electrical Engineering (Electronics) | FAST NUCES, CGPA 3.26/4.0 | Aug 2022 - Jun 2026\nMatriculation and Intermediate (Pre-Engineering) | Daanish Boys School, Rahim Yar Khan | 2018 - 2022',
    certsText: 'Industrial Training Certificate | WAPDA Engineering Academy, Faisalabad | 2025\nTeaching Assistant | Feedback Control Systems and Electrical Network Analysis, FAST NUCES | 2024 - 2026'
  },
  projects: [
    { title: 'Power Factor Optimization under Variable Solar Generation', date: 'Aug 2026 - Sep 2026', tools: ['Reactive power compensation', 'Capacitor banks', 'Solar PV'],
      summary: 'Investigating reactive power compensation strategies for periods of low plant load and high solar PV output, aiming to reduce capacitor bank switching losses.',
      work: 'Part of my internship at Pakistan Aluminium Beverage Cans. Studied how reactive power behaves when the plant load drops while solar output is high, and how to keep it balanced with fewer capacitor bank switching operations.',
      images: [], graphs: [{ title: 'Add your power factor readings here', type: 'line', data: 'Hour,Before,After\n8,0.82,0.95\n10,0.80,0.96\n12,0.74,0.97\n14,0.76,0.96\n16,0.83,0.97' }] },
    { title: 'SlideCastPi: Wireless Screen Mirroring Station', date: 'Aug 2025 - Jun 2026', tools: ['Raspberry Pi 4B', 'Python', 'Wireless streaming', 'Windows app'],
      summary: 'Final Year Project. A wireless screen mirroring system that streams to multiple devices with low latency, allows switching between them, and keeps the display in sync.',
      work: 'Wrote the Python backend and a small Windows control application. Integrated the hardware, Python backend, and Windows app into one system and tested it with multiple devices.\nTeam: Hadia, Nouman Shabbir, Zaheer Abbas. Supervisor: Dr. Muhammad Sajid Iqbal.',
      images: ['assets/slidecast-hardware.jpg', 'assets/slidecast-client.jpg', 'assets/slidecast-admin.jpg', 'assets/slidecast-splash.jpg'], graphs: [] },
    { title: 'Conveyor Belt Control System using PLC', date: 'Spring 2026', tools: ['Siemens S7-1200', 'Ladder Logic', 'KTP700 HMI', 'TIA Portal'],
      summary: 'An automated conveyor belt controlled by a Siemens S7-1200 PLC with real-time monitoring, simulating an industrial production line with start/stop control and fault detection.',
      work: 'Programmed the PLC in Ladder Logic for conveyor speed, direction and emergency stop sequences.\nDeveloped an HMI screen showing belt status, motor current and fault alarms.\nIntegrated proximity and limit switch sensors for object detection and sorting logic.\nImplemented interlocking and safety logic to prevent equipment damage under fault conditions.\nTested response time and reliability under simulated load.',
      images: ['assets/conveyor-hmi.jpg', 'assets/conveyor-belt.jpg', 'assets/conveyor-ladder.jpg'], graphs: [] },
    { title: 'Home Automation System and UPS Design', date: '', tools: ['ESP32', 'Relays', 'Sensors', 'Inverter', 'Proteus'],
      summary: 'An ESP32 smart home prototype and a simulated UPS.',
      work: 'Built an ESP32 smart home prototype with relay switching and multiple sensors.\nDesigned and simulated a UPS with battery charging, automatic mains-to-battery switchover, and a DC-to-AC inverter with overload protection.', images: [], graphs: [] },
    { title: 'Other Projects', date: '', tools: ['Embedded', 'Power electronics'],
      summary: 'Water level indicator, automatic traffic lights, solar panel tracking system, fire alarm detection system, automatic transfer switch.', work: '', images: [], graphs: [] }
  ]
};
