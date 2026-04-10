#!/usr/bin/env node

/**
 * MASTER TEST RUNNER
 * Menjalankan semua test suite secara berurutan
 * dan menghasilkan final report
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const tests = [
    { name: 'Implementation Verification', file: 'test-implementation.js', timeout: 10000 },
    { name: 'API Functional Test', file: 'test-api.js', timeout: 30000 },
    { name: 'Comprehensive System Test', file: 'test-comprehensive.js', timeout: 120000 },
    { name: 'Frontend Workflows Test', file: 'test-workflows.js', timeout: 120000 },
    { name: 'UI Simulation Test', file: 'test-ui-simulation.js', timeout: 120000 }
];

let passed = 0;
let failed = 0;
let totalTime = 0;

async function runTest(testInfo) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`⏳ Running: ${testInfo.name}`);
        console.log(`📁 File: ${testInfo.file}`);
        console.log(`${'='.repeat(70)}\n`);

        const startTime = Date.now();

        const proc = exec(`node ${testInfo.file}`, {
            cwd: __dirname,
            timeout: testInfo.timeout,
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });

        let output = '';
        
        proc.stdout.on('data', (data) => {
            process.stdout.write(data);
            output += data;
        });

        proc.stderr.on('data', (data) => {
            process.stderr.write(data);
            output += data;
        });

        proc.on('close', (code) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            totalTime += parseFloat(duration);

            console.log(`\n${'─'.repeat(70)}`);
            
            if (code === 0) {
                console.log(`✅ PASSED - Duration: ${duration}s`);
                passed++;
            } else {
                console.log(`❌ FAILED - Exit code: ${code} - Duration: ${duration}s`);
                failed++;
            }

            resolve({ success: code === 0, duration, output });
        });

        proc.on('error', (error) => {
            console.log(`❌ ERROR: ${error.message}`);
            failed++;
            resolve({ success: false, duration: '0', output: error.message });
        });
    });
}

async function runAllTests() {
    console.clear();
    console.log(`${'═'.repeat(70)}`);
    console.log(`🧪 MASTER TEST RUNNER - FINAL COMPREHENSIVE TESTING`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`\n📋 Running ${tests.length} test suites...\n`);

    const results = [];
    
    for (const test of tests) {
        const result = await runTest(test);
        results.push({ ...test, ...result });
    }

    // Final Summary
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 FINAL TEST SUMMARY`);
    console.log(`${'═'.repeat(70)}\n`);

    console.log(`Test Suites Run: ${tests.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${totalTime.toFixed(1)}s\n`);

    const passRate = Math.round((passed / tests.length) * 100);
    console.log(`📈 Pass Rate: ${passRate}%\n`);

    console.log(`Individual Results:`);
    results.forEach((result, idx) => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${idx + 1}. ${status} ${result.name} (${result.duration}s)`);
    });

    console.log(`\n${'═'.repeat(70)}`);
    
    if (failed === 0) {
        console.log(`🎉 ALL TESTS PASSED - SYSTEM IS PRODUCTION READY!`);
    } else {
        console.log(`⚠️  ${failed} test(s) failed - Review logs above`);
    }
    
    console.log(`${'═'.repeat(70)}\n`);

    // Write summary to file
    const summary = {
        timestamp: new Date().toISOString(),
        totalTime: totalTime.toFixed(1),
        testsPassed: passed,
        testsFailed: failed,
        passRate: passRate + '%',
        tests: results.map(r => ({
            name: r.name,
            file: r.file,
            passed: r.success,
            duration: parseFloat(r.duration)
        }))
    };

    fs.writeFileSync(
        path.join(__dirname, 'TEST_RESULTS.json'),
        JSON.stringify(summary, null, 2)
    );

    console.log(`📄 Results saved to: TEST_RESULTS.json\n`);

    return failed === 0;
}

// Run tests
runAllTests()
    .then(allPassed => {
        process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
        console.error(`Fatal error: ${error.message}`);
        process.exit(1);
    });
