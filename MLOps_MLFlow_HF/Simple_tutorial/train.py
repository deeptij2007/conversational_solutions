import logging
import sys
import warnings
from urllib.parse import urlparse

import numpy as np
import pandas as pd
from sklearn.linear_model import ElasticNet
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

import mlflow
import mlflow.sklearn
from mlflow.models.signature import infer_signature

logging.basicConfig(level=logging.WARN)
logger = logging.getLogger(__name__)

def eval_metrics(actual, pred):
    rmse = np.sqrt(mean_squared_error(actual, pred))
    mae = mean_absolute_error(actual, pred)
    r2 = r2_score(actual, pred)
    return rmse, mae, r2

if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    np.random.seed(40)

    # Read the wine-quality csv file from the URL
    csv_url = "https://raw.githubusercontent.com/mlflow/mlflow/master/tests/datasets/winequality-red.csv"

    import requests
    try:
        response = requests.get(csv_url)
        print(f"HTTP Status: {response.status_code}")
        print(f"Content preview: {response.text[:200]}")
    except Exception as e:
        print(f"Request failed: {e}")


    try:
        data = pd.read_csv(csv_url, sep=";")
    except Exception as e:
        logger.exception(
            "Unable to download training & test CSV, check your internet connection. Error: %s", e
        )

    # Split the data into training and test sets. (0.75, 0.25) split.
    train, test = train_test_split(data)

    # The predicted column is "quality" which is a scalar from [3, 9]   
    train_x = train.drop("quality", axis=1)
    test_x = test.drop("quality", axis=1)
    train_y = train["quality"]
    test_y = test["quality"]

    # Set default values if no alpha is provided
    alpha = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
    l1_ratio = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
    
    with mlflow.start_run():
        lr = ElasticNet(alpha=alpha, l1_ratio=l1_ratio, random_state=42)
        lr.fit(train_x, train_y)

        predicted_qualities = lr.predict(test_x)

        (rmse, mae, r2) = eval_metrics(test_y, predicted_qualities)

        print("Elasticnet model (alpha=%f, l1_ratio=%f):" % (alpha, l1_ratio))
        print("  RMSE: %s" % rmse)
        print("  MAE: %s" % mae)
        print("  R2: %s" % r2)
        
        mlflow.log_param("alpha", alpha)
        mlflow.log_param("l1_ratio", l1_ratio)
        mlflow.log_metric("rmse", rmse)
        mlflow.log_metric("mae", mae)
        mlflow.log_metric("r2", r2)
        mlflow.sklearn.log_model(lr, "model")

        print("Model saved in run %s" % mlflow.active_run().info.run_id)

        predictions=lr.predict(train_x)
        signature=infer_signature(train_x, predictions)

        tracking_url_type_store = urlparse(mlflow.get_tracking_uri()).scheme

        if tracking_url_type_store != "file":
            mlflow.sklearn.log_model(
                lr,
                "model",
                registered_model_name="ElasticnetWineModel",
                signature=signature,
            )
        else:
            mlflow.sklearn.log_model(lr, "model", signature=signature)