const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ParquetConverter {
  constructor(dataDirectory) {
    this.dataDirectory = dataDirectory;
    this.convertedDirectory = path.join(dataDirectory, 'converted');
    this.ensureConvertedDirectory();
  }

  ensureConvertedDirectory() {
    if (!fs.existsSync(this.convertedDirectory)) {
      fs.mkdirSync(this.convertedDirectory, { recursive: true });
      console.log(`📁 Created converted directory: ${this.convertedDirectory}`);
    }
  }

  /**
   * Parquet 파일을 CSV로 변환
   * @param {string} datasetId - 데이터셋 ID
   * @returns {Promise<string>} - 변환된 CSV 파일 경로
   */
  async convertParquetToCSV(datasetId) {
    const parquetPath = path.join(this.dataDirectory, `${datasetId}.parquet`);
    const csvPath = path.join(this.convertedDirectory, `${datasetId}.csv`);
    
    console.log(`🔄 Converting parquet to CSV: ${datasetId}`);
    console.log(`📂 Source: ${parquetPath}`);
    console.log(`📂 Target: ${csvPath}`);

    // 1. Parquet 파일 존재 확인
    if (!fs.existsSync(parquetPath)) {
      throw new Error(`Parquet file not found: ${parquetPath}`);
    }

    // 2. 이미 변환된 CSV가 있고 최신인지 확인
    if (await this.isCsvUpToDate(parquetPath, csvPath)) {
      console.log(`✅ Using existing CSV file: ${csvPath}`);
      return csvPath;
    }

    // 3. Python을 사용한 변환 시도
    try {
      await this.convertUsingPython(parquetPath, csvPath);
      console.log(`✅ Converted using Python: ${csvPath}`);
      return csvPath;
    } catch (pythonError) {
      console.warn(`⚠️ Python conversion failed: ${pythonError.message}`);
    }

    // 4. 대안: 미리 준비된 CSV 파일 사용
    const fallbackCsvPath = path.join(this.dataDirectory, `${datasetId}_fallback.csv`);
    if (fs.existsSync(fallbackCsvPath)) {
      console.log(`📋 Using fallback CSV: ${fallbackCsvPath}`);
      // 미리 준비된 CSV를 converted 디렉토리로 복사
      fs.copyFileSync(fallbackCsvPath, csvPath);
      return csvPath;
    }

    throw new Error(`Failed to convert parquet file and no fallback available: ${datasetId}`);
  }

  /**
   * Python을 사용하여 Parquet을 CSV로 변환
   */
  async convertUsingPython(parquetPath, csvPath) {
    return new Promise((resolve, reject) => {
      const pythonScript = this.generatePythonScript();
      const scriptPath = path.join(this.convertedDirectory, 'convert_parquet.py');
      
      // Python 스크립트 파일 생성
      fs.writeFileSync(scriptPath, pythonScript);

      // Python 실행 (가상환경 사용)
      const pythonPath = path.join(__dirname, '..', 'parquet_env', 'bin', 'python3');
      const python = spawn(pythonPath, [scriptPath, parquetPath, csvPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        // 임시 스크립트 파일 삭제
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          console.warn('Failed to cleanup Python script:', e.message);
        }

        if (code === 0 && fs.existsSync(csvPath)) {
          console.log(`🐍 Python conversion successful: ${stdout.trim()}`);
          resolve(csvPath);
        } else {
          console.error(`🐍 Python conversion failed (code ${code}):`, stderr);
          reject(new Error(`Python conversion failed: ${stderr || 'Unknown error'}`));
        }
      });

      python.on('error', (error) => {
        console.error(`🐍 Python process error:`, error);
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Python 변환 스크립트 생성
   */
  generatePythonScript() {
    return `#!/usr/bin/env python3
import pandas as pd
import sys
import os

def convert_parquet_to_csv(parquet_file, csv_file):
    try:
        print(f"Reading parquet file: {parquet_file}")
        
        # Parquet 파일 읽기
        df = pd.read_parquet(parquet_file)
        
        print(f"Data shape: {df.shape}")
        print(f"Columns: {list(df.columns)}")
        
        # CSV로 저장
        df.to_csv(csv_file, index=False, encoding='utf-8')
        
        print(f"Successfully converted to CSV: {csv_file}")
        print(f"Output file size: {os.path.getsize(csv_file)} bytes")
        
    except Exception as e:
        print(f"Error during conversion: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python convert_parquet.py <input.parquet> <output.csv>", file=sys.stderr)
        sys.exit(1)
    
    parquet_file = sys.argv[1]
    csv_file = sys.argv[2]
    
    convert_parquet_to_csv(parquet_file, csv_file)
`;
  }

  /**
   * CSV 파일이 최신인지 확인
   */
  async isCsvUpToDate(parquetPath, csvPath) {
    try {
      if (!fs.existsSync(csvPath)) {
        return false;
      }

      const parquetStats = fs.statSync(parquetPath);
      const csvStats = fs.statSync(csvPath);

      // CSV가 Parquet보다 최근에 생성되었으면 최신으로 판단
      return csvStats.mtime >= parquetStats.mtime;
    } catch (error) {
      return false;
    }
  }

  /**
   * 데이터셋 목록 가져오기
   */
  getAvailableDatasets() {
    const datasets = [];
    
    try {
      const files = fs.readdirSync(this.dataDirectory);
      
      files.forEach(file => {
        if (file.endsWith('.parquet')) {
          const datasetId = file.replace('.parquet', '');
          const parquetPath = path.join(this.dataDirectory, file);
          const csvPath = path.join(this.convertedDirectory, `${datasetId}.csv`);
          
          const stats = fs.statSync(parquetPath);
          const hasConvertedCsv = fs.existsSync(csvPath);
          
          datasets.push({
            id: datasetId,
            name: this.getDatasetName(datasetId),
            parquetFile: file,
            parquetSize: stats.size,
            hasConvertedCsv,
            lastModified: stats.mtime
          });
        }
      });
    } catch (error) {
      console.error('Error reading data directory:', error);
    }
    
    return datasets;
  }

  /**
   * 데이터셋 이름 매핑
   */
  getDatasetName(datasetId) {
    const nameMap = {
      'campaign_data': 'Campaign Data',
      'adpack_data': 'AdPack Data'
    };
    return nameMap[datasetId] || datasetId;
  }

  /**
   * 변환된 모든 CSV 파일 정리
   */
  cleanupConvertedFiles() {
    try {
      const files = fs.readdirSync(this.convertedDirectory);
      files.forEach(file => {
        const filePath = path.join(this.convertedDirectory, file);
        fs.unlinkSync(filePath);
      });
      console.log(`🗑️ Cleaned up ${files.length} converted files`);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

module.exports = ParquetConverter; 