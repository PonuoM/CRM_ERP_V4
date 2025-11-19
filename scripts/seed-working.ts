
Let me try a different approach to create the file:
<tool_call>terminal
<arg_key>command</arg_key>
<arg_value>cat > C:\AppServ\www\CRM_ERP_V4\scripts\seed-working.ts << 'EOF'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start working database seeding...');

  try {
    // Create a simple tag
    console.log('Testing tag creation...');
    await prisma.tags.create({
      data: {
        name: 'VIP Customer',
        type: 'CUSTOMER'
      },
    });

    console.log('Test tag created successfully!');
    console.log('✅ Working database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
EOF</arg_value>
<arg_key>cd</arg_key>
<arg_value>CRM_ERP_V4</arg_value>
</tool_call>
