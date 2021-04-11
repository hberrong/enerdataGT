library(dplyr)
library(lubridate)
library(tidyverse)
library(forecast)
library(yardstick)
library(recipes)
library(magrittr)
library(tidyquant)
library(padr)
library(tidyr)
library(ggpubr)
library(plotly)
library(ggplot2)
library(TSstudio)
library(timetk)
library(tsibble)
library(fable)

#Load EIA data
data <- read.csv("sales_annual.csv", skip = 1, header = T)
data$Year <- ymd(data$Year, truncated = 2L)
#nrow(data)

#Create table of state names and abbreviations to map to NREL data
stateLookup <- tibble(state = state.name)%>%bind_cols(tibble(abb = state.abb))%>%bind_rows(tibble(state = "District of Columbia", abb = "DC"))%>%bind_rows(tibble(state = "United States", abb = "US")) %>% rename(state_name = state, State = abb)
#head(stateLookup)

#Remove unncessary data and format remaining data for usability
#new_data = data[data$Industry.Sector.Category == "Total Electric Industry", ]
#new_data = data[data$State != "US", ]
new_data <- subset(data, Industry.Sector.Category == "Total Electric Industry" & State != "US")
new_data <- subset(new_data, select = c(Year, State, Residential, Commercial, Industrial, Other,Transportation, Total))
new_data <- arrange(new_data, Year, State)
new_data$Residential <- as.integer(gsub(",", "", new_data$Residential))
new_data$Commercial <- as.integer(gsub(",", "", new_data$Commercial))
new_data$Industrial <- as.integer(gsub(",", "", new_data$Industrial))
new_data$Other <- as.integer(gsub(",", "", new_data$Other))
new_data$Transportation <- as.integer(gsub(",", "", new_data$Transportation))
new_data$Total <- as.integer(gsub(",", "", new_data$Total))
new_data <- mutate(new_data, Year = year(as.character(Year)))
dataWithName = left_join(new_data, stateLookup, by = "State")
dataWithName[is.na(dataWithName)] <- 0
dataWithName$Transportation_Other <- dataWithName$Transportation + dataWithName$Other
#head(dataWithName)



# Getting the train/test set
dataWithName$Sample = ifelse(dataWithName$Year >= as.Date("2012-07-01"),"Test","Train")
str(dataWithName)
trainSet <- subset(dataWithName, Sample == "Train")
testSet <- subset(dataWithName, Sample == "Test")
#print(testSet)

#Create dataframes for forecasted values
residentialTrain <- subset(dataWithName, Year <= 2012, select = c("Year", "State", "Residential", "Sample")) %>% as_tsibble(key = State, index = Year)
#residentialFull <- subset(dataWithName, select = c("Year", "State", "Residential", "Sample"))%>% mutate(Year = year(as.character(Year))) %>% as_tsibble(key = State, index = Year)
#summarize(residentialTest)
#residentialTrain%>%autoplot(Residential)
commercialTrain <- subset(dataWithName, Year <= 2012,select = c("Year", "State", "Commercial", "Sample")) %>% as_tsibble(key = State, index = Year)
#commercialTest <- subset(dataWithName, Sample == "Test", select = c("Year", "State", "Commercial", "Sample"))%>% mutate(Year = year(as.character(Year))) %>% as_tsibble(key = State, index = Year)
#head(commercialData)
commercialTrain%>%autoplot(Commercial)
industrialTrain <- subset(dataWithName, Year <= 2012,select = c("Year", "State", "Industrial", "Sample")) %>% as_tsibble(key = State, index = Year)
#industrialFull <- subset(dataWithName, select = c("Year", "State", "Industrial", "Sample"))%>% mutate(Year = year(as.character(Year))) %>% as_tsibble(key = State, index = Year)
#head(commercialTrain)
industrialTrain%>%autoplot(Industrial)
otherTrain <- subset(dataWithName, Year <= 2012,select = c("Year", "State", "Other", "Sample")) %>% as_tsibble(key = State, index = Year)
#otherTest <- subset(dataWithName, Sample == "Test", select = c("Year", "State", "Other", "Sample"))%>% mutate(Year = year(as.character(Year))) %>% as_tsibble(key = State, index = Year)
#head(otherTrain)
otherTrain%>%autoplot(Other)
transportationTrain <- subset(dataWithName, Year <= 2012,select = c("Year", "State", "Transportation", "Sample")) %>% as_tsibble(key = State, index = Year)
#transportationTest <- subset(dataWithName, Sample == "Test", select = c("Year", "State", "Transportation", "Sample"))%>% mutate(Year = year(as.character(Year))) %>% as_tsibble(key = State, index = Year)
#head(transportationTrain)
transportationTrain%>%autoplot(Transportation)
transportationOtherTrain <- subset(dataWithName, Year <= 2012,select = c("Year", "State", "Transportation_Other", "Sample")) %>% as_tsibble(key = State, index = Year)
#transportationOtherTest <- subset(dataWithName, Sample == "Test", select = c("Year", "State", "Transportation_Other", "Sample"))%>% mutate(Year = year(as.character(Year))) %>% as_tsibble(key = State, index = Year)
#head(transportationOtherTrain)
transportationOtherTrain%>%autoplot(Transportation_Other)

#Create models
residentialETS <- residentialTrain %>% model(ets = ETS(Residential))
residentialARIMA <- residentialTrain %>% model(arima = ARIMA(Residential))
commercialETS <- commercialTrain %>% model(ets = ETS(Commercial))
commercialARIMA <- commercialTrain %>% model(arima = ARIMA(Commercial))
industrialETS <- industrialTrain %>% model(ets = ETS(Industrial))
industrialARIMA <- industrialTrain %>% model(arima = ARIMA(Industrial))
otherETS <- otherTrain %>% model(ets = ETS(Other))
otherARIMA <- otherTrain %>% model(arima = ARIMA(Other))
transportationETS <- transportationTrain %>% model(ets = ETS(Transportation))
transportationARIMA <- transportationTrain %>% model(arima = ARIMA(Transportation))
transportationOtherETS <- transportationOtherTrain %>% model(ets = ETS(Transportation_Other))
transportationOtherARIMA <- transportationOtherTrain %>% model(arima = ARIMA(Transportation_Other))

#Forecast models
residentialForecastETS <- residentialETS %>% forecast(h = "37 years")
residentialForecastARIMA <- residentialARIMA %>% forecast(h = "37 years")
commercialForecastETS <- commercialETS %>% forecast(h = "37 years")
commercialForecastARIMA <- commercialARIMA %>% forecast(h = "37 years")
industrialForecastETS <- industrialETS %>% forecast(h = 37)
industrialForecastARIMA <- industrialARIMA %>% forecast(h = 37)
otherForecastETS <- otherETS %>% forecast(h = "37 years")
otherForecastARIMA <- otherARIMA %>% forecast(h = "37 years")
transportationForecastETS <- transportationETS %>% forecast(h = "37 years")
transportationForecastARIMA <- transportationARIMA %>% forecast(h = "37 years")
transportationOtherForecastETS <- transportationOtherETS %>% forecast(h = "37 years")
transportationOtherForecastARIMA <- transportationOtherARIMA %>% forecast(h = "37 years")
#print(residentialForecastETS)

#Create ARIMA Dataframe
arimaDF <- subset(residentialForecastARIMA, select = c("Year", "State", ".mean")) %>% rename(Residential = .mean) %>% 
  merge(commercialForecastARIMA[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Commercial = .mean) %>%
  merge(industrialForecastARIMA[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Industrial = .mean) %>%
  merge(otherForecastARIMA[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Other = .mean) %>%
  merge(transportationForecastARIMA[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Transportation = .mean)
arimaDF <- replace(arimaDF, arimaDF < 0, 0)
arimaDF$Total <- arimaDF$Residential + arimaDF$Commercial + arimaDF$Industrial + arimaDF$Other + arimaDF$Transportation
print(arimaDF)
arimaTransOtherDF <- subset(residentialForecastARIMA, select = c("Year", "State", ".mean")) %>% rename(Residential = .mean) %>% 
  merge(commercialForecastARIMA[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Commercial = .mean) %>%
  merge(industrialForecastARIMA[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Industrial = .mean) %>%
  merge(transportationOtherForecastARIMA[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(transportationOther = .mean)
arimaTransOtherDF <- replace(arimaTransOtherDF < 0, 0)
arimaTransOtherDF$Total <- arimaTransOtherDF$Residential + arimaTransOtherDF$Commercial + arimaTransOtherDF$Industrial + arimaTransOtherDF$transportationOther
print(arimaTransOtherDF)

#Create ETS Dataframe
etsDF <- subset(residentialForecastETS, select = c("Year", "State", ".mean")) %>% rename(Residential = .mean) %>% 
  merge(commercialForecastETS[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Commercial = .mean) %>%
  merge(industrialForecastETS[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Industrial = .mean) %>%
  merge(otherForecastETS[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Other = .mean) %>%
  merge(transportationForecastETS[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Transportation = .mean)
etsDF <- replace(etsDF, etsDF < 0, 0)
etsDF$Total <- etsDF$Residential + etsDF$Commercial + etsDF$Industrial + etsDF$Other + etsDF$Transportation
print(etsDF)
etsTransOtherDF <- subset(residentialForecastETS, select = c("Year", "State", ".mean")) %>% rename(Residential = .mean) %>% 
  merge(commercialForecastETS[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Commercial = .mean) %>%
  merge(industrialForecastETS[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(Industrial = .mean) %>%
  merge(transportationOtherForecastETS[, c("Year", "State", ".mean")], by=c("Year","State"), all.x=TRUE) %>% rename(transportationOther = .mean)
etsTransOtherDF <- replace(etsTransOtherDF, etsTransOtherDF < 0, 0)
etsTransOtherDF$Total <- etsTransOtherDF$Residential + etsTransOtherDF$Commercial + etsTransOtherDF$Industrial + etsTransOtherDF$transportationOther
print(etsTransOtherDF)

#Calculate MAPE to compare accuracy of models
##Exponential Smoothing WITHOUT Transportation and Other merged
etstMAPETotalDF <- merge(etsDF, new_data[, c("Year", "State", "Total")], by = c("Year", "State"), all = TRUE) %>% drop_na() %>% rename(Actual = Total.y, Predict = Total.x)
#print(estMAPETotalDF)
etsMAPE <- mean(abs((etsMAPETotalDF$Actual - etsMAPETotalDF$Predict)/etsMAPETotalDF$Actual))*100
print(estMAPE)
##Exponential Smoothing WITH transportation and Other merged
estMAPETotalDF <- merge(etsDF, new_data[, c("Year", "State", "Total")], by = c("Year", "State"), all = TRUE) %>% drop_na() %>% rename(Actual = Total.y, Predict = Total.x)
print(estMAPETotalDF)
estMAPE <- mean(abs((estMAPETotalDF$Actual - estMAPETotalDF$Predict)/estMAPETotalDF$Actual))*100
print(estMAPE)
##ARIMA WITHOUT transportation and other merged
estMAPETotalDF <- merge(etsDF, new_data[, c("Year", "State", "Total")], by = c("Year", "State"), all = TRUE) %>% drop_na() %>% rename(Actual = Total.y, Predict = Total.x)
print(estMAPETotalDF)
estMAPE <- mean(abs((estMAPETotalDF$Actual - estMAPETotalDF$Predict)/estMAPETotalDF$Actual))*100
print(estMAPE)
##ARIMA WITH transportation and other merged
estMAPETotalDF <- merge(etsDF, new_data[, c("Year", "State", "Total")], by = c("Year", "State"), all = TRUE) %>% drop_na() %>% rename(Actual = Total.y, Predict = Total.x)
print(estMAPETotalDF)
estMAPE <- mean(abs((estMAPETotalDF$Actual - estMAPETotalDF$Predict)/estMAPETotalDF$Actual))*100
print(estMAPE)
#write.csv(loadForecast, "Desktop\\DVA\\Group Project\\salesTotal_prediction.csv", row.names = FALSE)