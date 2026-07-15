import prisma from "../lib/db/prisma";

async function main() {
  const machines = await prisma.machineProfile.findMany();
  for (const machine of machines) {
    console.log({
      name: machine.name,
      raw: String(machine.defaultKerfMm),
      num: machine.defaultKerfMm.toNumber(),
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
