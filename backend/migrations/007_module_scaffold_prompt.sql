-- Add scaffold prompt to modules for customizing AI scaffolding generation
ALTER TABLE modules ADD COLUMN IF NOT EXISTS scaffold_prompt TEXT DEFAULT NULL;

-- Example prompts:
-- "Generate scaffolding steps in Spanish"
-- "Use simple language for ELL students at level 1"
-- "Include visual representations and number lines"
-- "Focus on concrete manipulatives before abstract concepts"
