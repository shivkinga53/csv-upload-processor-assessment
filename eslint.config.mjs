// eslint.config.mjs
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        languageOptions: { 
            ecmaVersion: "latest", 
            sourceType: "module", 
            globals: { 
                process: "readonly", 
                console: "readonly", 
                Buffer: "readonly", 
                setTimeout: "readonly", 
                clearInterval: "readonly", 
                setInterval: "readonly", 
                window: "readonly", 
                document: "readonly", 
                fetch: "readonly", 
                alert: "readonly",
                FormData: "readonly",        
                URLSearchParams: "readonly",  
                describe: "readonly",         
                it: "readonly",               
                expect: "readonly",           
                jest: "readonly",             
                beforeAll: "readonly",        
                afterAll: "readonly"          
            } 
        },
        rules: { 
            "no-unused-vars": "warn",
            "no-undef": "warn"
        }
    }
];